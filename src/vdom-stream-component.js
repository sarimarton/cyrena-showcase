import xs from 'xstream'
import cloneDeep from 'lodash/cloneDeep'

const prefix = 'vsc-'

export function component (config, vdom) {
  const vdomProp = config.vdomProp

  const isComponent = node =>
    typeof node.type === 'function'

  let cmps = []

  const traverse = (node, parent = null, path = []) => {
    const key = path[path.length - 1] || 0

    if (isComponent(node)) {
      cmps.push({
        cmp: node.type,
        parent,
        key
      })
    }

    if (node.$$typeof === Symbol.for('react.element')) {
      node.key = node.key || prefix + path.join('.')
    }

    ;[node.props && node.props.children]
      .flat()
      .filter(_ => _)
      .forEach((n, idx) => traverse(n, node, [...path, idx]))
  }

  let _vdom = cloneDeep(vdom)

  traverse(_vdom)

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

export function cycleReactComponent (vdom) {
  return component({
    vdomProp: 'react',
    merge: []
  }, vdom)
}
