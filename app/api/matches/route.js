import { supabase } from '@/lib/supabase'

// GET /api/matches?userId=xxx → liste de tous les matches avec profil
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) return Response.json({ error: 'userId requis' }, { status: 400 })

  // Récupérer tous les matches où l'user est impliqué
  const { data: matchesData, error } = await supabase
    .from('matches')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Pour chaque match, récupérer le profil de l'autre personne
  const enriched = await Promise.all(
    matchesData.map(async (match) => {
      const otherId = match.user1_id === userId ? match.user2_id : match.user1_id

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherId)
        .single()

      // Dernier message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return { ...match, profile, lastMessage: lastMsg || null }
    })
  )

  return Response.json({ matches: enriched })
}
