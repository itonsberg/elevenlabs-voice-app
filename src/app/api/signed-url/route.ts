/**
 * Signed URL API Route
 * Generates a signed URL for ElevenLabs Conversational AI
 *
 * This is REQUIRED for:
 * - Private agents (most production setups)
 * - Agents with access to sensitive tools
 * - API key authentication (keeps key server-side)
 *
 * Without this, the client would need to expose ELEVENLABS_API_KEY
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const agentId = process.env.ELEVENLABS_AGENT_ID
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!agentId || !apiKey) {
    console.error('[Signed URL] Missing ELEVENLABS_AGENT_ID or ELEVENLABS_API_KEY')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    // Request signed URL from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Signed URL] ElevenLabs error:', response.status, errorText)
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // The response contains { signed_url: "wss://..." }
    return NextResponse.json({
      signedUrl: data.signed_url,
    })
  } catch (error) {
    console.error('[Signed URL] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get signed URL' },
      { status: 500 }
    )
  }
}
