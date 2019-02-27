import xs from 'xstream'

import cloneDeep from 'lodash/cloneDeep'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import omit from 'lodash/omit'

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

  // Invoke cycle components in the vdom, and get the sinks
  // Also pass key and props to them
  let sinks = cmps.map(cfg =>
    cfg.node.type({
      sources,
      key: cfg.node.key,
      props: cfg.node.props
    })
  )

  // Get the vdoms from among the sinks
  let vdoms = sinks.map(sink =>
    sink[vdomProp]
  )

  // Combine the vdom streams and map them placed into the original structure
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

      // Without cloning, React won't pick up the changes and the view
      // doesn't refresh
      return cloneDeep(hiddenRoot.props.children[0])
    })

  // Gather all the other sinks which is not the vdom and merge them together
  // by type
  let allOtherSinksOfAllComponents =
    sinks.reduce(
      (acc, next) => mergeWith(
        acc,
        omit(next, vdomProp),
        (addition, src) => compact([...castArray(addition), src])
      ),
      mapValues(castArray)(config.otherSinks || {})
    )
    |> mapValues(sinks => xs.merge.apply(xs, sinks))

  return {
    [vdomProp]: vdom$,
    ...allOtherSinksOfAllComponents
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
