import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  // 1. 定義多個備援爬蟲端點 (依序嘗試)
  const HF_ENDPOINTS = [
    "https://pyfbsdk59-twstock-tracker-api.hf.space/api/scrape",
    "https://lawxstudents168-twstock-tracker-api.hf.space/api/scrape",
    "https://igveri59-twstock-tracker-api.hf.space/api/scrape"
  ]

  let hfData: any = null
  let lastError: any = null
  let usedEndpoint = ""

  // 2. 執行故障轉移機制：遍歷所有端點直到有一個成功
  for (const url of HF_ENDPOINTS) {
    try {
      console.log(`[Cloud Scrape] 嘗試端點: ${url}`)
      // 由於爬蟲較耗時，設定 60 秒超時 (Timeout)
      hfData = await $fetch(url, { method: 'GET', timeout: 60000 })
      
      if (hfData && hfData.date) {
        usedEndpoint = url
        console.log(`[Cloud Scrape] 成功取得資料，來源: ${url}`)
        break // 成功取得資料，跳出迴圈
      }
    } catch (err: any) {
      lastError = err
      console.warn(`[Cloud Scrape] 端點 ${url} 呼叫失敗: ${err.message}`)
      // 繼續嘗試下一個端點...
    }
  }

  // 若所有端點都失敗，拋出錯誤給前端
  if (!hfData) {
    throw createError({
      statusCode: 502,
      message: `所有爬蟲端點均無回應。最後錯誤: ${lastError?.message || '未知錯誤'}`
    })
  }

  // 3. 解析從 Hugging Face 傳回的資料
  const { date, yahoo_stats, yahoo_top30 } = hfData
  const stats = yahoo_stats || []
  const top30 = yahoo_top30 || []

  // 4. 初始化 Supabase Service Role Client (繞過 RLS 安全檢查以進行寫入)
  const supabase = await serverSupabaseServiceRole(event)

  try {
    // A. 刪除該時間戳記的舊資料 (防止在極罕見情況下產生重複紀錄)
    // 雖然 date 精確到秒，但為了系統強健性仍執行此動作
    await supabase.from('category_stats').delete().eq('date', date)
    await supabase.from('daily_top30').delete().eq('date', date)

    // B. 準備類股統計 Payload
    const statsPayload = stats.map((s: any) => ({
      date,
      market: s.market,
      category: s.category,
      avg_change_pct: s.avg_change_pct,
      avg_price: s.avg_price,
      avg_vol: s.avg_vol
    }))

    // C. 準備 Top 30 Payload
    const top30Payload = top30.map((t: any) => ({
      date,
      rank: t.rank,
      ticker: t.ticker,
      name: t.name,
      market: t.market,
      total_value: t.total_value
    }))

    // D. 執行資料庫批次寫入
    if (statsPayload.length > 0) {
      const { error: statsError } = await supabase.from('category_stats').insert(statsPayload)
      if (statsError) throw statsError
    }

    if (top30Payload.length > 0) {
      const { error: top30Error } = await supabase.from('daily_top30').insert(top30Payload)
      if (top30Error) throw top30Error
    }

    // 5. 回傳成功訊息給前端
    return {
      success: true,
      message: `雲端同步完成！資料時間：${date}`,
      source: usedEndpoint
    }

  } catch (error: any) {
    console.error('[Supabase Error] 寫入失敗:', error)
    throw createError({
      statusCode: 500,
      message: `資料庫寫入失敗: ${error.message}`
    })
  }
})
