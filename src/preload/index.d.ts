import type { DahiaApi } from './index'

declare global {
  interface Window {
    dahia: DahiaApi
  }
}

export {}
