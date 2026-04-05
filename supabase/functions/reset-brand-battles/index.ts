import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find all brand_battle polls that have ended
    const now = new Date().toISOString()
    const { data: expiredBattles, error: fetchError } = await supabase
      .from('polls')
      .select('id, option_a, option_b, starts_at, ends_at, category')
      .eq('expiry_type', 'brand_battle')
      .eq('is_active', true)
      .not('ends_at', 'is', null)
      .lt('ends_at', now)

    if (fetchError) throw fetchError
    if (!expiredBattles || expiredBattles.length === 0) {
      return new Response(JSON.stringify({ message: 'No expired brand battles', reset: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let resetCount = 0

    for (const poll of expiredBattles) {
      // Get current vote data
      const { data: votes } = await supabase
        .from('votes')
        .select('choice, voter_gender, voter_age_range, voter_city')
        .eq('poll_id', poll.id)

      const totalVotes = votes?.length || 0
      const votesA = votes?.filter(v => v.choice === 'A').length || 0
      const votesB = totalVotes - votesA
      const percentA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 0
      const percentB = totalVotes > 0 ? 100 - percentA : 0

      // Build demographic summary
      const genderCounts: Record<string, { a: number; b: number }> = {}
      const ageCounts: Record<string, { a: number; b: number }> = {}
      const cityCounts: Record<string, { a: number; b: number }> = {}

      votes?.forEach(v => {
        if (v.voter_gender) {
          if (!genderCounts[v.voter_gender]) genderCounts[v.voter_gender] = { a: 0, b: 0 }
          if (v.choice === 'A') genderCounts[v.voter_gender].a++
          else genderCounts[v.voter_gender].b++
        }
        if (v.voter_age_range) {
          if (!ageCounts[v.voter_age_range]) ageCounts[v.voter_age_range] = { a: 0, b: 0 }
          if (v.choice === 'A') ageCounts[v.voter_age_range].a++
          else ageCounts[v.voter_age_range].b++
        }
        if (v.voter_city) {
          if (!cityCounts[v.voter_city]) cityCounts[v.voter_city] = { a: 0, b: 0 }
          if (v.choice === 'A') cityCounts[v.voter_city].a++
          else cityCounts[v.voter_city].b++
        }
      })

      // Determine cycle number
      const { data: existingCycles } = await supabase
        .from('poll_cycles')
        .select('cycle_number')
        .eq('poll_id', poll.id)
        .order('cycle_number', { ascending: false })
        .limit(1)

      const nextCycle = (existingCycles?.[0]?.cycle_number || 0) + 1

      // Archive the cycle
      const { error: cycleError } = await supabase
        .from('poll_cycles')
        .insert({
          poll_id: poll.id,
          cycle_number: nextCycle,
          cycle_start: poll.starts_at || poll.ends_at,
          cycle_end: poll.ends_at,
          votes_a: votesA,
          votes_b: votesB,
          total_votes: totalVotes,
          percent_a: percentA,
          percent_b: percentB,
          demographic_data: { gender: genderCounts, age: ageCounts, city: cityCounts },
        })

      if (cycleError) {
        console.error(`Failed to archive cycle for poll ${poll.id}:`, cycleError)
        continue
      }

      // Delete current votes for this poll
      await supabase.from('votes').delete().eq('poll_id', poll.id)
      // Also clear skipped_polls for fresh start
      await supabase.from('skipped_polls').delete().eq('poll_id', poll.id)

      // Reset the poll with new 30-day window
      const newStart = new Date()
      const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0, 23, 59, 59)

      await supabase
        .from('polls')
        .update({
          starts_at: newStart.toISOString(),
          ends_at: newEnd.toISOString(),
        })
        .eq('id', poll.id)

      resetCount++
      console.log(`Reset brand battle: ${poll.option_a} vs ${poll.option_b} (cycle ${nextCycle})`)
    }

    return new Response(JSON.stringify({ message: `Reset ${resetCount} brand battles`, reset: resetCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Brand battle reset error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
