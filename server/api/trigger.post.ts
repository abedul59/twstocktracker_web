import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  // 1. 呼叫 Hugging Face Space API
  // 記得把這裡的網址換成你部署好的 HF Space 網址
  const HF_API_URL = "https://your-hf-username-spacename.hf.space/api/scrape"
  
  let hfData;
  try {
    hfData = await $fetch(HF_API_URL)
  } catch (err: any) {
    throw createError({ statusCode: 502, message: `Hugging Face 爬蟲失敗: ${err.message}` })
  }

  const date = hfData.date
  const stats = hfData.yahoo_stats || []
  const top30 = hfData.yahoo_top30 || []

  if (!date) {
    throw createError({ statusCode: 400, message: 'Hugging Face 回傳資料缺少日期' })
  }

  // 2. 將資料存入 Supabase
  const supabase = await serverSupabaseServiceRole(event)

  try {
    // 刪除當日舊資料避免重複
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

    if (statsPayload.length > 0) await supabase.from('category_stats').insert(statsPayload)
    if (top30Payload.length > 0) await supabase.from('daily_top30').insert(top30Payload)

    return { success: true, message: `雲端同步完成！已更新 ${date} 資料。` }
  } catch (error: any) {
    console.error('Supabase 寫入詳細錯誤:', error)
    throw createError({ statusCode: 500, message: `資料庫寫入失敗: ${error.message}` })
  }
})
