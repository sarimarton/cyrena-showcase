import { default as xs, Stream, MemoryStream } from 'xstream'
import { h } from '@cycle/react'
import {
  makePragma,
  component as powerCycleComponent
} from '../component.js'
import { createElement, Fragment, useState, useEffect } from 'react'

export const pragma = makePragma(h)

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams),
  isStreamFn: val => val instanceof Stream || val instanceof MemoryStream
}

export function ReactDomain (sources) {
  const reducer$ = xs.create({
    start: function () {},
    stop: function () {}
  })

  return {
    react: xs.of(
      createElement(
        Fragment,
        null,
        [sources.props.children]
          .flat()
          .map((cmp, idx) =>
            cmp && cmp.$$typeof === Symbol.for('react.element')
              ? {
                ...cmp,
                key: cmp.key != null ? cmp.key : idx,
                props: { ...cmp.props, sources: { ...sources, reducer$ } }
              }
              : cmp
          )
      )
    ),
    state: reducer$
  }
}

export function useCycleState (sources) {
  const [state, setState] = useState(0)

  useEffect(() => {
    sources.state.stream.subscribe({
      next: state => { setState(state) }
    })
  }, [])

  return [
    state,
    state => {
      sources.reducer$.shamefullySendNext(() => state)
    }
  ]
}

export function StateLens (sources) {
  return component(
    sources,
    createElement(Fragment, null, sources.props.children),
    {}
  )
}

export const component = (sources, vdom, otherSinks, config) =>
  powerCycleComponent(sources, vdom, { ...CONFIG, otherSinks, ...config })
