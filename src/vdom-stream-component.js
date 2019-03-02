import xs from 'xstream'

import cloneDeep from 'lodash/cloneDeep'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'

const isComponentNode = node =>
  typeof node.type === 'function'

const streamConstructor =
  Object.getPrototypeOf(xs.of()).constructor

const isStreamNode = node =>
  node instanceof streamConstructor

const traverseVdom = traverseAction => (node, path = [], cmpList = [], streamNodeList = []) => {
  if (traverseAction(node, path, cmpList, streamNodeList)) {
    compact(castArray(node.props && node.props.children))
      .forEach((n, idx) => {
        traverseVdom(traverseAction)(n, [...path, { node, idx }], cmpList, streamNodeList)
      })
  }

  return [cmpList, streamNodeList]
}

const replaceNode = (root, path, value) => {
  let n = root
  for (let i = 0; i < path.length - 1; i++) {
    n = castArray(n.props.children)[path[i]]
  }

  const props = n.props
  const idx = path[path.length - 1]

  if (Array.isArray(props.children)) {
    props.children[idx] = value
  } else {
    props.children = value
  }
}

export const component = (sources, vdom, config) => {
  // Wrap the whole tree in an additional root node to
  const root = ({
    props: { children: [cloneDeep(vdom)] }
  })

  const vdomProp = config.vdomProp
  const additionalTraverseAction = config.additionalTraverseAction || (() => {})

  const traverseAction = (node, path, cmpList, streamNodeList) => {
    const _isComponent = isComponentNode(node)

    additionalTraverseAction(node, path)

    if (_isComponent) {
      cmpList.push({
        node,
        path: path.map(n => n.idx),
        // Invoke cycle components in the vdom, and get the sinks
        // Also pass key and props to them
        sinks: node.type({ ...sources, ...pick(node, ['key', 'props']) })
      })
    }

    if (isStreamNode(node)) {
      streamNodeList.push({
        node,
        path: path.map(n => n.idx)
      })
    }

    return !_isComponent
  }

  const [cmps, streamNodes] = traverseVdom(traverseAction)(root)

  // Get the vdoms from among the sinks
  const vdoms = cmps.map(cmp => cmp.sinks[vdomProp])

  // Combine the vdom streams and map them placed into the original structure
  const vdom$ = xs.combine.apply(xs, vdoms)
    .map(vdoms => {
      const _root = cloneDeep(root)

      zip(vdoms, cmps).forEach(([vdom, cmp]) => {
        replaceNode(_root, cmp.path, { ...vdom, key: vdom.key })
      })

      return _root.props.children[0]
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
  const _config = {
    // The name of the vdom sink
    vdomProp: 'react',

    // Prevent React warnings about lacking 'key' prop
    additionalTraverseAction: (node, path) => {
      if (node.$$typeof === Symbol.for('react.element')) {
        node.key = node.key || path[path.length - 1].idx
      }
    },

    otherSinks
  }

  return component(sources, vdom, _config)
}
