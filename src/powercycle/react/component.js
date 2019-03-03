import xs from 'xstream'
import { h } from '@cycle/react'
import {
  VDOM_ELEMENT_FLAG,
  makePragma,
  component as powerCycleComponent
} from '../component.js'

export const pragma = makePragma(h)

export function ReactComponentWrapper (sources) {
  return {
    react: xs.of(sources.props.children)
  }
}

export const component = (sources, vdom, otherSinks) => {
  const streamConstructor = Object.getPrototypeOf(xs.of()).constructor

  const _config = {
    vdomProp: 'react',
    combineFn: streams => xs.combine(...streams),
    mergeFn: streams => xs.merge(...streams),
    isStreamFn: val => val instanceof streamConstructor,
    otherSinks
  }

  return powerCycleComponent(sources, vdom, _config)
}
