import cloneDeepWith from 'lodash/cloneDeepWith'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import set from 'lodash/set'
import defaultTo from 'lodash/defaultTo'

const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')

export const makePragma = pragma => (node, attr, ...children) =>
  ({
    ...pragma(
      node,
      { ...attr },
      children.map((c, i) => {
        if (typeof c === 'object' && c && !c.key) c.key = i
        return c
      })
    ),
    [VDOM_ELEMENT_FLAG]: true
  })

const isComponentNode = node =>
  node && typeof node.type === 'function'

const traverse = (action, obj, path = [], acc = []) => {
  let [_acc, stop] = action(acc, obj, path)

  if (!stop && typeof obj === 'object') {
    for (let k in obj) {
      _acc = traverse(action, obj[k], [...path, k], _acc)
    }
  }

  return _acc
}

const makeTraverseAction = (sources, isStream) => (acc, val, path) => {
  const _isStream = isStream(val)
  const isCmp = isComponentNode(val)

  // Add key props to prevent React warnings
  if (val && val[VDOM_ELEMENT_FLAG]) {
    val.key = defaultTo(val.key, path[path.length - 1])
  }

  if (_isStream || isCmp) {
    acc.push({
      val,
      path,
      isCmp,
      ...isCmp && {
        sinks: val.type({ ...sources, ...pick(val, ['key', 'props']) })
      }
    })
  }

  return [acc, _isStream || isCmp]
}

export const component = (sources, vdom, config) => {
  const cloneDeep = obj => cloneDeepWith(
    obj,
    value => config.isStreamFn(value) ? value : undefined
  )

  // This one-time clone is needed to be able to
  // amend the read-only react vdom with auto generated keys
  const root = cloneDeep(vdom)

  const streamInfoRecords = traverse(
    makeTraverseAction(sources, config.isStreamFn),
    root
  )

  // Get the signal streams (the ones which need to be combined)
  const signalStreams = streamInfoRecords.map(node =>
    node.isCmp
      ? node.sinks[config.vdomProp]
      : node.val
  )

  // Combine the vdom and stream node streams,
  // and place their values into the original structure
  const vdom$ = config.combineFn(signalStreams)
    .map(signalValues => {
      // It's needed to make react detect changes
      const _root = cloneDeep(root)

      zip(signalValues, streamInfoRecords).forEach(([val, info]) => {
        set(
          _root,
          info.path,
          info.isCmp ? { ...val, key: defaultTo(info.val.key, val.key) } : val
        )
      })

      return _root
    })

  // Gather all other sinks and merge them together by type
  const allOtherSinksOfAllComponents =
    [streamInfoRecords]
      .map(xs => xs.filter(info => info.isCmp))
      .map(xs => xs.map(info => info.sinks))
      .map(xs => [config.otherSinks || {}, ...xs])
      .map(xs => xs.reduce(
        (acc, next) => mergeWith(
          acc,
          omit(next, config.vdomProp),
          (addition, src) => compact([...castArray(addition), src])
        ),
        {}
      ))
      .map(mapValues(sinks => config.mergeFn(sinks)))
      [0]

  return {
    [config.vdomProp]: vdom$,
    ...allOtherSinksOfAllComponents
  }
}
