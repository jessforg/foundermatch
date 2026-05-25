import { supabase } from '@/lib/supabase'

// GET /api/messages?matchId=xxx → tous les messages d'un match
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('matchId')

  if (!matchId) return Response.json({ error: 'matchId requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ messages: data })
}

// POST /api/messages → envoyer un message
export async function POST(request) {
  const { matchId, senderId, text } = await request.json()

  if (!matchId || !senderId || !text?.trim()) {
    return Response.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, text: text.trim() })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ message: data })
}
