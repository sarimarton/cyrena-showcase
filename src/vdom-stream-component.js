import xs from 'xstream'
import cloneDeep from 'lodash/cloneDeep'

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
  const _vdom = cloneDeep(vdom)
  const vdomProp = config.vdomProp
  const additionalTraverseAction = config.additionalTraverseAction || (() => {})

  const cmps = []

  const traverseAction = (node, path) => {
    const parent = path[path.length - 1] || { node: undefined, idx: 0 }

    if (isComponent(node)) {
      cmps.push({
        cmp: node.type,
        parent: parent.node,
        key: parent.idx
      })
    }

    additionalTraverseAction(node, path)
  }

  traverseVdom(traverseAction)(_vdom)

  let sinks = cmps.map(cfg => cfg.cmp())
  let vdoms = sinks.map(sink => sink[vdomProp])

  let vdom$ = xs.combine.apply(xs, vdoms)
    .map(vdoms => {
      vdoms.forEach((vdom, idx) => {
        const { children } = cmps[idx].parent.props
        const { key } = cmps[idx]

        children[key] = {
          ...vdom,
          key: vdom.key || children[key].key
        }
      })

      return _vdom
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
