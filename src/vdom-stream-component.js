import xs from 'xstream'
import cloneDeep from 'lodash/cloneDeep'
import zip from 'lodash/zip'

const isComponent = node =>
  typeof node.type === 'function'

const traverseVdom = action => (node, path = []) => {
  if (action(node, path)) {
    ;[node.props && node.props.children]
      .flat()
      .filter(_ => _)
      .forEach((n, idx) => traverseVdom(action)(n, [...path, { node, idx }]))
  }
}

export const component = (sources, vdom, config) => {
  let hiddenRoot = {
    props: { children: [cloneDeep(vdom)] }
  }

  const vdomProp = config.vdomProp
  const additionalTraverseAction = config.additionalTraverseAction || (() => {})

  const cmps = []

  const traverseAction = (node, path) => {
    const parent = path[path.length - 1] || { node: undefined, idx: 0 }
    const _isComponent = isComponent(node)

    if (_isComponent) {
      cmps.push({ node, parent })
    }

    additionalTraverseAction(node, path)

    return !_isComponent
  }

  traverseVdom(traverseAction)(hiddenRoot)

  let sinks = cmps.map(cfg =>
    cfg.node.type({
      sources,
      key: cfg.node.key,
      props: cfg.node.props
    })
  )

  let vdoms = sinks.map(sink =>
    sink[vdomProp]
  )

  let vdom$ = xs.combine.apply(xs, vdoms)
    .map(vdoms => {
      zip(vdoms, cmps).forEach(([vdom, cmp]) => {
        const idx = cmp.parent.idx
        const props = cmp.parent.node.props
        const originalNode = [props.children].flat()[idx]
        const setter =
          Array.isArray(props.children)
            ? value => { props.children[idx] = value }
            : value => { props.children = value }

        setter({
          ...vdom,
          key: vdom.key || originalNode.key
        })
      })

      return cloneDeep(hiddenRoot.props.children[0])
    })

  return {
    [vdomProp]: vdom$
  }
}

export const cycleReactComponent = (sources, vdom, otherSinks) => {
  // This is a react component key prefix
  const reactKeyPrefix = 'vsc-' + (sources.key || '')

  const _config = {

    // The vdom sink
    vdomProp: 'react',

    // Prevent React warnings about lacking 'key' prop
    additionalTraverseAction: (node, path) => {
      if (node.$$typeof === Symbol.for('react.element')) {
        node.key =
          node.key ||
          reactKeyPrefix + path.map(p => p.idx).join('.')
      }
    },

    otherSinks
  }

  return component(sources, vdom, _config)
}
