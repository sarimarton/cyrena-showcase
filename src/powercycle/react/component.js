import xs from 'xstream'
import { h } from '@cycle/react'
import {
  makePragma,
  component as powerCycleComponent
} from '../component.js'
import { createElement, Fragment, useState, useEffect } from 'react'

export const pragma = makePragma(h)

const streamConstructor = Object.getPrototypeOf(xs.of()).constructor

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams),
  isStreamFn: val => val instanceof streamConstructor
}

export function ReactDomain (sources) {
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
                props: { ...cmp.props, sources }
              }
              : cmp
          )
      )
    )
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
      sources.state.stream.shamefullySendNext(state)
    }
  ]
}

export const component = (sources, vdom, otherSinks) =>
  powerCycleComponent(sources, vdom, { ...CONFIG, otherSinks })
