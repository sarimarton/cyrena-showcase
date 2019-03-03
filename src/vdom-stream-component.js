import xs from 'xstream'

import cloneDeepWith from 'lodash/cloneDeepWith'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import set from 'lodash/set'

const isComponentNode = node =>
  node && typeof node.type === 'function'

const streamConstructor =
  Object.getPrototypeOf(xs.of()).constructor

const isStream = val =>
  val instanceof streamConstructor

const cloneDeep = obj =>
  cloneDeepWith(obj, value =>
    isStream(value)
      ? value
      : undefined
  )

const traverse = (action, obj, path = [], acc = []) => {
  var [_acc, goDeeper] = action(acc, obj, path)

  if (typeof obj === 'object' && goDeeper) {
    for (let k in obj) {
      _acc = traverse(action, obj[k], [...path, k], _acc)
    }
  }

  return _acc
}

const getTraverseAction = (sources, extraTraverseAction) => (acc, val, path) => {
  const _isStream = isStream(val)
  const _isCmp = isComponentNode(val)

  extraTraverseAction(val, path)

  if (_isStream || _isCmp) {
    acc.push({
      val,
      path,
      isCmp: _isCmp,
      ..._isCmp && {
        sinks: val.type({ ...sources, ...pick(val, ['key', 'props']) })
      }
    })
  }

  return [acc, !_isStream && !_isCmp]
}

const getAllSinksMergedOtherThanVdom = (vdomProp, mergeFn, sinks) =>
  mapValues(sinks => mergeFn(sinks))(
    sinks.reduce(
      (acc, next) => mergeWith(
        acc,
        omit(next, vdomProp),
        (addition, src) => compact([...castArray(addition), src])
      ),
      {}
    )
  )

export const component = (sources, vdom, config) => {
  // Wrap the whole tree in an additional root node to
  const root = ({
    props: { children: [cloneDeep(vdom)] }
  })

  const vdomProp = config.vdomProp

  const traverseAction = getTraverseAction(
    sources,
    config.extraTraverseAction || (() => {})
  )

  const streamNodes = traverse(traverseAction, root)

  // Get the signal streams (the ones which need to be combined)
  const signalStreams = streamNodes.map(node =>
    node.isCmp
      ? node.sinks[vdomProp]
      : node.val
  )

  // Combine the vdom and stream node streams
  // and map them placed into the original structure
  // We should probably break these lists out into separate combine
  // calls, but my attempt failed... this is such a fragile business here
  let vdom$ = xs.combine(...signalStreams)
    .map(signalValues => {
      const _root = cloneDeep(root)

      zip(signalValues, streamNodes).forEach(([val, info]) => {
        set(
          _root,
          info.path,
          info.isCmp ? { ...val, key: val.key || info.val.key } : val
        )
      })

      return _root.props.children[0]
    })

  // Gather all the other sinks which are not the vdom and merge them together
  // by type
  const allOtherSinksOfAllComponents =
    getAllSinksMergedOtherThanVdom(
      vdomProp,
      sinks => xs.merge(...sinks),
      [
        config.otherSinks || {},
        ...streamNodes.filter(info => info.isCmp).map(info => info.sinks)
      ]
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
    extraTraverseAction: (node, path) => {
      // It's a little ugly, will work it out
      const isRoot = path.join('.') === 'props.children.0'

      if (!isRoot && node && node.$$typeof === Symbol.for('react.element')) {
        node.key = node.key || path[path.length - 1]
      }
    },

    otherSinks
  }

  return component(sources, vdom, _config)
}
