import { describe, expect, it } from 'vitest'

import {
  requireEmbedding,
  requireFirstChoice,
  requireFirstMessageContent,
} from '../packages/shared/src/openaiGuard'

describe('openaiGuard', () => {
  describe('requireEmbedding', () => {
    it('returns the first embedding when present', () => {
      const embedding = requireEmbedding({ data: [{ embedding: [1, 2, 3] }] })
      expect(embedding).toEqual([1, 2, 3])
    })

    it('throws when embedding array is missing', () => {
      expect(() => requireEmbedding({ data: [{}] })).toThrowError(
        /missing embedding data/
      )
    })
  })

  describe('requireFirstChoice', () => {
    it('returns the first choice', () => {
      const choice = requireFirstChoice({
        choices: [{ message: { content: 'hello' } }],
      })
      expect(choice?.message?.content).toBe('hello')
    })

    it('throws when choices array is empty', () => {
      expect(() => requireFirstChoice({ choices: [] })).toThrowError(
        /missing choices\[0\]/
      )
    })
  })

  describe('requireFirstMessageContent', () => {
    it('returns message content when present', () => {
      const content = requireFirstMessageContent({
        choices: [{ message: { content: 'result' } }],
      })
      expect(content).toBe('result')
    })

    it('throws when message content is missing', () => {
      expect(() => requireFirstMessageContent({ choices: [{}] })).toThrowError(
        /missing message content/
      )
    })
  })
})
