import xs from 'xstream'

import cloneDeepWith from 'lodash/cloneDeepWith'
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

const cloneDeep = obj =>
  cloneDeepWith(obj, value => isStreamNode(value) ? value : undefined)

const traverseVdom = traverseAction => (node, path = [], cmpList = [], streamNodeList = []) => {
  if (traverseAction(node, path, cmpList, streamNodeList)) {
    const children = Array.isArray(node)
      ? node
      : castArray(node.props && node.props.children)

    children.forEach((n, idx) => {
      if (n) {
        traverseVdom(traverseAction)(n, [...path, { node, idx }], cmpList, streamNodeList)
      }
    })
  }

  return [cmpList, streamNodeList]
}

const replaceNode = (root, path, value) => {
  let node = root
  let i

  for (i = 0; i < path.length - 1; i++) {
    node = Array.isArray(node)
      ? node
      : castArray(node.props.children)[path[i]]
  }

  if (Array.isArray(node)) {
    node[path[i]] = value
  } else if (Array.isArray(node.props.children)) {
    node.props.children[path[i]] = value
  } else {
    node.props.children = value
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
    const isComponent = isComponentNode(node)

    additionalTraverseAction(node, path)

    if (isComponent) {
      cmpList.push({
        path: path.map(n => n.idx),
        // Invoke cycle components in the vdom, and get the sinks
        // Also pass key and props to them
        sinks: node.type({ ...sources, ...pick(node, ['key', 'props']) })
      })
    }

    if (isStreamNode(node)) {
      streamNodeList.push({
        path: path.map(n => n.idx),
        stream: node
      })
    }

    return !isComponent
  }

  const [cmps, streamNodes] = traverseVdom(traverseAction)(root)

  // Get the vdoms from among the sinks
  const vdoms = cmps.map(cmp => cmp.sinks[vdomProp])

  // Get the stream node values
  const streamNodeValues = streamNodes.map(n => n.stream)

  // Combine the vdom and stream node streams
  // and map them placed into the original structure
  let vdom$ = xs.combine(...vdoms, ...streamNodeValues)
    .map(vdomsAndStreamNodeValues => {
      const _root = cloneDeep(root)

      const vdoms = vdomsAndStreamNodeValues.slice(0, cmps.length)
      const streamNodeValues = vdomsAndStreamNodeValues.slice(cmps.length)

      zip(vdoms, cmps).forEach(([vdom, cmp]) => {
        replaceNode(_root, cmp.path, { ...vdom, key: vdom.key })
      })

      zip(streamNodeValues, streamNodes).forEach(([streamNodeValue, streamNode]) => {
        replaceNode(_root, streamNode.path, streamNodeValue)
      })

      return _root.props.children[0]
    })

  const sinks = cmps.map(cmp => cmp.sinks)

  // Gather all the other sinks which are not the vdom and merge them together
  // by type
  const allOtherSinksOfAllComponents =
    mapValues(sinks => xs.merge(...sinks))(
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
