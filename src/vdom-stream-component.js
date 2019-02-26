import xs from 'xstream'
import cloneDeep from 'lodash/cloneDeep'
import zip from 'lodash/zip'

const isComponent = node =>
  typeof node.type === 'function'

const traverseVdom = fn => (node, path = []) => {
  fn(node, path)

  ;[node.props && node.props.children]
    .flat()
    .filter(_ => _)
    .forEach((n, idx) => traverseVdom(fn)(n, [...path, { node, idx }]))
}

export const component = config => vdom => {
  let hiddenRoot = {
    props: { children: [cloneDeep(vdom)] }
  }

  const vdomProp = config.vdomProp
  const additionalTraverseAction = config.additionalTraverseAction || (() => {})

  const cmps = []

  const traverseAction = (node, path) => {
    const parent = path[path.length - 1] ||
      {
        node: {
          props: {
            children: [{}]
          }
        },
        idx: 0
      }

    if (isComponent(node)) {
      cmps.push({ node, parent })
    }

    additionalTraverseAction(node, path)
  }

  traverseVdom(traverseAction)(hiddenRoot)

  let sinks = cmps.map(cfg => cfg.node.type())
  let vdoms = sinks.map(sink => sink[vdomProp])

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

      return hiddenRoot.props.children[0]
    })

  return {
    [vdomProp]: vdom$
  }
}

export const cycleReactComponent = vdom => {
  const reactKeyPrefix = 'vsc-'

  return component({
    vdomProp: 'react',
    additionalTraverseAction: (node, path) => {
      if (node.$$typeof === Symbol.for('react.element')) {
        node.key =
          node.key ||
          reactKeyPrefix + path.map(p => p.idx).join('.')
      }
    }
  })(vdom)
}
