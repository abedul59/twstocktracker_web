import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)
    
    // 對現有的 category_stats 表進行最輕量的查詢 (只抓一筆 date)
    const { data, error } = await supabase
      .from('category_stats')
      .select('date')
      .limit(1)

    if (error) throw error

    return { success: true, message: '台股資金流向 Supabase 喚醒成功！' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})
