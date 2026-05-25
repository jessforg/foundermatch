import { supabase } from '@/lib/supabase'

// POST /api/swipes
// body: { swiperId, swipedId, direction: 'match'|'pass' }
export async function POST(request) {
  const { swiperId, swipedId, direction } = await request.json()

  if (!swiperId || !swipedId || !direction) {
    return Response.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // 1. Enregistrer le swipe
  const { error: swipeError } = await supabase
    .from('swipes')
    .upsert({ swiper_id: swiperId, swiped_id: swipedId, direction })

  if (swipeError) return Response.json({ error: swipeError.message }, { status: 500 })

  // 2. Si c'est un "match", vérifier si l'autre a aussi liké
  if (direction === 'match') {
    const { data: reverseSwipe } = await supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', swipedId)
      .eq('swiped_id', swiperId)
      .eq('direction', 'match')
      .single()

    // Match mutuel ! Créer l'entrée dans matches
    if (reverseSwipe) {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .upsert({
          user1_id: swiperId < swipedId ? swiperId : swipedId,
          user2_id: swiperId < swipedId ? swipedId : swiperId,
        })
        .select()
        .single()

      if (matchError) return Response.json({ error: matchError.message }, { status: 500 })

      return Response.json({ matched: true, match: matchData })
    }
  }

  return Response.json({ matched: false })
}
