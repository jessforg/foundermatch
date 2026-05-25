import { supabase } from '@/lib/supabase'

// GET /api/profiles?userId=xxx  → profils à découvrir (pas encore swipés)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const sector = searchParams.get('sector')
  const stage = searchParams.get('stage')

  if (!userId) return Response.json({ error: 'userId requis' }, { status: 400 })

  // IDs déjà swipés par cet utilisateur
  const { data: swipedData } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', userId)

  const swipedIds = swipedData?.map(s => s.swiped_id) || []
  swipedIds.push(userId) // Exclure soi-même

  // Requête profils
  let query = supabase
    .from('profiles')
    .select('*')
    .not('id', 'in', `(${swipedIds.join(',')})`)
    .limit(20)

  if (sector && sector !== 'Tous') query = query.eq('sector', sector)
  if (stage && stage !== 'Tous') query = query.eq('stage', stage)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ profiles: data })
}

// PUT /api/profiles → mettre à jour son profil
export async function PUT(request) {
  const body = await request.json()
  const { userId, ...profileData } = body

  if (!userId) return Response.json({ error: 'userId requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profileData })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ profile: data })
}
