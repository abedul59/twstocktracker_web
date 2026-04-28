import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const headers = getHeaders(event)
  const authHeader = headers['authorization']
  const expectedToken = `Bearer ${process.env.API_SYNC_TOKEN}`

  if (authHeader !== expectedToken) {
    // 【修改】: 將 statusMessage 改為 message
    throw createError({ statusCode: 401, message: '身分驗證失敗：Token 錯誤' })
  }

  const body = await readBody(event)
  const date = body.date 
  const stats = body.yahoo_stats || []
  const top30 = body.yahoo_top30 || []

  if (!date) {
    throw createError({ statusCode: 400, message: '缺少日期資料' })
  }

  try {
    const supabase = await serverSupabaseServiceRole(event)

    await supabase.from('category_stats').delete().eq('date', date)
    await supabase.from('daily_top30').delete().eq('date', date)

    const statsPayload = stats.map((s: any) => ({
      date, market: s.market, category: s.category,
      avg_change_pct: s.avg_change_pct, avg_price: s.avg_price, avg_vol: s.avg_vol
    }))

    const top30Payload = top30.map((t: any) => ({
      date, rank: t.rank, ticker: t.ticker, name: t.name,
      market: t.market, total_value: t.total_value
    }))

    if (statsPayload.length > 0) {
      const { error } = await supabase.from('category_stats').insert(statsPayload)
      if (error) throw error
    }

    if (top30Payload.length > 0) {
      const { error } = await supabase.from('daily_top30').insert(top30Payload)
      if (error) throw error
    }

    return { success: true, message: `成功同步 ${date} 的資料` }
  } catch (error: any) {
    // 【重要新增】: 把最詳細的 Supabase 錯誤直接印在 Vercel 的終端機裡！
    console.error('Supabase 寫入詳細錯誤:', error)
    
    // 【修改】: 遵守 Nitro 新規定，使用 message 而不是 statusMessage
    throw createError({ statusCode: 500, message: `資料庫寫入失敗: ${error.message}` })
  }
})
