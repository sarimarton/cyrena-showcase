import xs from 'xstream'

import cloneDeep from 'lodash/cloneDeep'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'

const isComponent = node =>
  typeof node.type === 'function'

const traverseVdom = traverseAction => (node, path = [], acc = []) => {
  if (traverseAction(node, path, acc)) {
    compact(castArray(node.props && node.props.children))
      .forEach((n, idx) => {
        traverseVdom(traverseAction)(n, [...path, { node, idx }], acc)
      })
  }

  return acc
}

export const component = (sources, vdom, config) => {
  // Wrap the whole tree in an additional root node to
  let hiddenRoot = {
    props: { children: [cloneDeep(vdom)] }
  }

  const vdomProp = config.vdomProp
  const additionalTraverseAction = config.additionalTraverseAction || (() => {})

  const traverseAction = (node, path, acc) => {
    const parent = path[path.length - 1] || { node: undefined, idx: 0 }
    const _isComponent = isComponent(node)

    additionalTraverseAction(node, path)

    if (_isComponent) {
      acc.push({
        node,
        parent,
        // Invoke cycle components in the vdom, and get the sinks
        // Also pass key and props to them
        sinks: node.type({ ...sources, ...pick(node, ['key', 'props']) })
      })
    }

    return !_isComponent
  }

  const cmps = traverseVdom(traverseAction)(hiddenRoot)

  // Get the vdoms from among the sinks
  const vdoms = cmps.map(cmp => cmp.sinks[vdomProp])

  // Combine the vdom streams and map them placed into the original structure
  const vdom$ = xs.combine.apply(xs, vdoms)
    .map(vdoms => {
      zip(vdoms, cmps).forEach(([vdom, cmp]) => {
        const idx = cmp.parent.idx
        const props = cmp.parent.node.props
        const originalNode = [props.children].flat()[idx]
        const setter =
          Array.isArray(props.children)
            ? value => { props.children[idx] = value }
            : value => { props.children = value }

        setter({ ...vdom, key: vdom.key || originalNode.key })
      })

      // Without cloning, React won't pick up the changes and the view
      // doesn't refresh
      return cloneDeep(hiddenRoot.props.children[0])
    })

  const sinks = cmps.map(cmp => cmp.sinks)

  // Gather all the other sinks which is not the vdom and merge them together
  // by type
  const allOtherSinksOfAllComponents =
    mapValues(sinks => xs.merge.apply(xs, sinks))(
      sinks.reduce(
        (acc, next) => mergeWith(
          acc,
          omit(next, vdomProp),
          (addition, src) => compact([...castArray(addition), src])
        ),
        mapValues(castArray)(config.otherSinks || {})
      )
    )

  return {
    [vdomProp]: vdom$,
    ...allOtherSinksOfAllComponents
  }
}

export const cycleReactComponent = (sources, vdom, otherSinks) => {
  // This is a react component key prefix
  const reactKeyPrefix = 'vsc-' + (sources.key || '')

  const _config = {

    // The name of the vdom sink
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
