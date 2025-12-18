/*
 * CodeAnalyzer - Interactive dependency graph viewer
 * Copyright (C) 2025
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// ===== TYPES =====

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama'
  apiKey: string
  model: string
  ollamaUrl?: string
}

export interface FileContext {
  fileName: string
  relativePath: string
  content: string
  imports: string[]
  usedBy: string[]
  language: string
}

export interface GeneratedDescription {
  short: string
  long: string
}

// ===== PROMPT TEMPLATE =====

function buildPrompt(context: FileContext): string {
  return `Tu es un expert en analyse de code et architecture logicielle. Analyse ce fichier et génère deux descriptions.

## Instructions

1. **SHORT_DESCRIPTION** (max 100 caractères):
   - Description très concise de ce que fait ce fichier
   - Format: verbe à l'infinitif + objet
   - Exemples: "Gérer l'authentification utilisateur", "Afficher le graphe de dépendances"

2. **LONG_DESCRIPTION** (3-5 phrases):
   - Le rôle principal et les responsabilités du fichier
   - Comment il s'intègre dans l'architecture globale
   - Points importants pour un architecte logiciel
   - Patterns utilisés ou points d'attention

## Contexte du fichier

- **Fichier**: ${context.fileName}
- **Chemin**: ${context.relativePath}
- **Importe**: ${context.imports.length > 0 ? context.imports.join(', ') : 'Aucun import interne'}
- **Utilisé par**: ${context.usedBy.length > 0 ? context.usedBy.join(', ') : 'Aucun fichier'}

## Code source

\`\`\`${context.language}
${context.content}
\`\`\`

## Format de réponse

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks):
{"short": "...", "long": "..."}`
}

// ===== RESPONSE PARSING =====

function parseResponse(response: string): GeneratedDescription {
  // Try to extract JSON from the response
  let jsonStr = response.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      jsonStr = match[1].trim()
    }
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      short: String(parsed.short || '').slice(0, 150),
      long: String(parsed.long || '')
    }
  } catch {
    // Fallback: try to extract from text
    console.warn('Failed to parse JSON response, using fallback')
    return {
      short: 'Description non disponible',
      long: response.slice(0, 500)
    }
  }
}

// ===== OPENAI PROVIDER =====

async function generateWithOpenAI(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const OpenAI = (await import('openai')).default

  const client = new OpenAI({
    apiKey: config.apiKey
  })

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: 'Tu es un assistant expert en analyse de code. Tu réponds toujours en JSON valide.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  })

  return response.choices[0]?.message?.content || ''
}

// ===== ANTHROPIC PROVIDER =====

async function generateWithAnthropic(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default

  const client = new Anthropic({
    apiKey: config.apiKey
  })

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const textBlock = response.content.find(block => block.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}

// ===== OLLAMA PROVIDER =====

async function generateWithOllama(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const baseUrl = config.ollamaUrl || 'http://localhost:11434'

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.response || ''
}

// ===== PUBLIC API =====

/**
 * Generate description for a file using the configured LLM
 */
export async function generateFileDescription(
  config: LLMConfig,
  context: FileContext
): Promise<GeneratedDescription> {
  const prompt = buildPrompt(context)

  let response: string

  switch (config.provider) {
    case 'openai':
      response = await generateWithOpenAI(config, prompt)
      break
    case 'anthropic':
      response = await generateWithAnthropic(config, prompt)
      break
    case 'ollama':
      response = await generateWithOllama(config, prompt)
      break
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }

  return parseResponse(response)
}

/**
 * Test connection to the LLM provider
 */
export async function testLLMConnection(
  config: LLMConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const testPrompt = 'Réponds uniquement avec: {"status": "ok"}'

    switch (config.provider) {
      case 'openai':
        await generateWithOpenAI(config, testPrompt)
        break
      case 'anthropic':
        await generateWithAnthropic(config, testPrompt)
        break
      case 'ollama':
        await generateWithOllama(config, testPrompt)
        break
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Get language identifier from file extension
 */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'vue':
      return 'vue'
    case 'svelte':
      return 'svelte'
    default:
      return 'typescript'
  }
}
