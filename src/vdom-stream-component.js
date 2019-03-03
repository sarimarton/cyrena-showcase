import xs from 'xstream'
import { h } from '@cycle/react'

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

const VDOM_ELEMENT_FLAG = '__element'

const cyclePragma = h

export const pragma = (node, attr, ...children) =>
  ({ ...cyclePragma(node, { ...attr }, children), [VDOM_ELEMENT_FLAG]: true })

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

const getTraverseAction = (sources, isStream) => (acc, val, path) => {
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
  const cloneDeep = obj => cloneDeepWith(obj,
    value => config.isStreamFn(value) ? value : undefined
  )

  // This one-time clone is needed to be able to
  // amend the read-only react vdom with auto generated keys
  const root = cloneDeep(vdom)

  const vdomProp = config.vdomProp

  const traverseAction = getTraverseAction(sources, config.isStreamFn)

  const streamInfoRecords = traverse(traverseAction, root)

  // Get the signal streams (the ones which need to be combined)
  const signalStreams = streamInfoRecords.map(node =>
    node.isCmp
      ? node.sinks[vdomProp]
      : node.val
  )

  // Combine the vdom and stream node streams,
  // and set them map them placed into the original structure
  const vdom$ = config.combineFn(signalStreams)
    .map(signalValues => {
      // It's needed to make react detect changes
      const _root = cloneDeep(root)

      zip(signalValues, streamInfoRecords).forEach(([val, info]) => {
        set(
          _root,
          info.path,
          info.isCmp ? { ...val, key: defaultTo(val.key, info.val.key) } : val
        )
      })

      return _root
    })

  // Gather all other sinks which are not the vdom and merge them together by type
  const allOtherSinksOfAllComponents =
    getAllSinksMergedOtherThanVdom(
      vdomProp,
      config.mergeFn,
      [
        config.otherSinks || {},
        ...streamInfoRecords.filter(info => info.isCmp).map(info => info.sinks)
      ]
    )

  return {
    [vdomProp]: vdom$,
    ...allOtherSinksOfAllComponents
  }
}

export const cycleReactComponent = (sources, vdom, otherSinks) => {
  const _config = {
    vdomProp: 'react',
    combineFn: streams => xs.combine(...streams),
    mergeFn: streams => xs.merge(...streams),
    isStreamFn: val => val instanceof Object.getPrototypeOf(xs.of()).constructor,
    otherSinks
  }

  return component(sources, vdom, _config)
}
