<template>
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3 flex-wrap gap-3">
      <h1 class="title mb-0">📈 台股資金流向儀表板</h1>

      <div class="d-flex align-items-center gap-3 flex-wrap">
        <button class="btn btn-primary fw-bold shadow-sm" @click="triggerCloudScrape" :disabled="isScraping">
          <span v-if="isScraping" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
          {{ isScraping ? '雲端爬蟲執行中 (約需30秒)...' : '🚀 觸發雲端即時同步' }}
        </button>

        <div class="d-flex align-items-center gap-2" v-if="availableDates.length > 0">
          <label class="fw-bold text-nowrap text-secondary mb-0">📅 歷史：</label>
          <select class="form-select w-auto fw-bold shadow-sm text-primary" v-model="selectedDate">
            <option v-for="d in availableDates" :key="d" :value="d">
              {{ formatDisplayDate(d) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="scrapeStatus" class="alert alert-info fw-bold shadow-sm border-0">
      {{ scrapeStatus }}
    </div>

    <div v-if="availableDates.length === 0 && !isScraping" class="alert alert-warning text-center shadow-sm border-0 fw-bold">
      目前資料庫尚無任何數據，請點擊上方「🚀 觸發雲端即時同步」按鈕來獲取最新資料。
    </div>

    <div v-if="statsData.length > 0" class="data-section card shadow-sm border-0 overflow-hidden">
      <div class="tabs-header d-flex border-bottom bg-light">
        <button class="tab-btn main-tab" :class="{ active: mainTab === '類股' }" @click="mainTab = '類股'">
          📊 類股平均數據
        </button>
        <button class="tab-btn main-tab" :class="{ active: mainTab === 'TOP30' }" @click="mainTab = 'TOP30'">
          🔥 成交額 Top 30
        </button>
      </div>

      <div v-if="mainTab === '類股'" class="p-3">
        <div class="d-flex justify-content-center gap-2 mb-3">
          <button class="btn btn-sm fw-bold px-4" :class="marketTab === '上市' ? 'btn-danger' : 'btn-outline-danger'" @click="marketTab = '上市'">上市類股</button>
          <button class="btn btn-sm fw-bold px-4" :class="marketTab === '上櫃' ? 'btn-primary' : 'btn-outline-primary'" @click="marketTab = '上櫃'">上櫃類股</button>
          <button class="btn btn-sm fw-bold px-4" :class="marketTab === '興櫃' ? 'btn-success' : 'btn-outline-success'" @click="marketTab = '興櫃'">興櫃類股</button>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-dark">
              <tr>
                <th>市場</th>
                <th>類股名稱</th>
                <th>平均漲跌幅</th>
                <th>平均股價 (元)</th>
                <th class="text-end">平均成交量 (張)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in filteredStats" :key="stat.id">
                <td><span :class="['badge', getBadgeClass(stat.market)]">{{ stat.market }}</span></td>
                <td class="fw-bold">{{ stat.category }}</td>
                <td :class="stat.avg_change_pct.includes('-') ? 'text-green' : 'text-red'">{{ stat.avg_change_pct }}</td>
                <td>{{ stat.avg_price }}</td>
                <td class="text-end">{{ stat.avg_vol }}</td>
              </tr>
              <tr v-if="filteredStats.length === 0">
                <td colspan="5" class="text-center py-4 text-muted fw-bold">此市場目前無資料</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="mainTab === 'TOP30'" class="p-3">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-warning">
              <tr>
                <th>排名</th>
                <th>市場</th>
                <th>代碼</th>
                <th>名稱</th>
                <th class="text-end">估算成交金額 (千元)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stock in top30Data" :key="stock.id">
                <td><span class="badge bg-dark fs-6 shadow-sm">#{{ stock.rank }}</span></td>
                <td><span :class="['badge', getBadgeClass(stock.market)]">{{ stock.market }}</span></td>
                <td class="fw-bold text-secondary">{{ stock.ticker }}</td>
                <td class="fw-bold fs-5">{{ stock.name }}</td>
                <td class="text-end fw-bold text-danger fs-5">{{ stock.total_value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
const supabase = useSupabaseClient()

// ================= UI 狀態 =================
const mainTab = ref('類股')
const marketTab = ref('上市')

// ================= 資料狀態 =================
const statsData = ref([])
const top30Data = ref([])
const availableDates = ref([])
const selectedDate = ref('')

// ================= 爬蟲狀態 =================
const isScraping = ref(false)
const scrapeStatus = ref('')

// ================= 輔助函式 =================
// 將 14 位數時間戳記 (20260310143005) 格式化為易讀格式 (2026-03-10 14:30:05)
const formatDisplayDate = (ts) => {
  if (!ts || ts.length !== 14) return ts
  const y = ts.substring(0, 4)
  const m = ts.substring(4, 6)
  const d = ts.substring(6, 8)
  const hh = ts.substring(8, 10)
  const mm = ts.substring(10, 12)
  const ss = ts.substring(12, 14)
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const getBadgeClass = (market) => {
  if (market === '上市') return 'bg-danger'
  if (market === '上櫃') return 'bg-primary'
  if (market === '興櫃') return 'bg-success'
  return 'bg-secondary'
}

// 過濾類股數據 (依照選擇的市場)
const filteredStats = computed(() => {
  return statsData.value.filter(stat => stat.market === marketTab.value)
})

// ================= 核心功能：觸發雲端爬蟲 API =================
const triggerCloudScrape = async () => {
  isScraping.value = true
  scrapeStatus.value = '⏳ 正在呼叫 Hugging Face 啟動爬蟲，請稍候（約需 20~40 秒）...'
  
  try {
    const response = await $fetch('/api/trigger', { method: 'POST' })
    scrapeStatus.value = `✅ ${response.message}`
    
    // 爬取完畢後，重新掃描資料庫日期，並自動切換畫面到最新的一筆 (包含分秒)
    await fetchAvailableDates()
    if (availableDates.value.length > 0) {
      selectedDate.value = availableDates.value[0]
      await loadDataForDate(selectedDate.value)
    }
  } catch (err) {
    scrapeStatus.value = `❌ 錯誤: ${err.data?.message || err.message}`
  } finally {
    isScraping.value = false
    
    // 5秒後自動隱藏提示訊息
    setTimeout(() => {
      if (!isScraping.value) scrapeStatus.value = ''
    }, 5000)
  }
}

// ================= 核心功能：讀取資料庫 =================

// 1. 掃描資料庫有哪幾天的歷史紀錄
const fetchAvailableDates = async () => {
  // 只撈取 date 欄位，減少流量
  const { data, error } = await supabase.from('category_stats').select('date')
  if (!error && data) {
    // 提取所有時間戳記 -> 利用 Set 去重 -> 由新到舊 (降序) 排序
    const uniqueTimestamps = [...new Set(data.map(item => item.date))].sort((a, b) => b.localeCompare(a))
    availableDates.value = uniqueTimestamps
    
    // 如果有資料且尚未選擇，預設選擇最新的一筆
    if (uniqueTimestamps.length > 0 && !selectedDate.value) {
      selectedDate.value = uniqueTimestamps[0]
    }
  }
}

// 2. 讀取特定時間點的資料明細
const loadDataForDate = async (targetDate) => {
  if (!targetDate) return

  // 抓取該時間點的類股，並以漲跌幅排序
  const { data: sData } = await supabase
    .from('category_stats')
    .select('*')
    .eq('date', targetDate)

  if (sData) {
    statsData.value = sData.sort((a, b) => {
      // 移除 % 與 + 號，轉為浮點數進行正確的大小排序
      const valA = parseFloat(a.avg_change_pct.replace('%', '').replace('+', '')) || 0
      const valB = parseFloat(b.avg_change_pct.replace('%', '').replace('+', '')) || 0
      return valB - valA
    })
  }

  // 抓取該時間點的 Top 30，並以名次排序
  const { data: tData } = await supabase
    .from('daily_top30')
    .select('*')
    .eq('date', targetDate)
    .order('rank', { ascending: true })

  if (tData) {
    top30Data.value = tData
  }
}

// 監聽日期選單變化，一變動就去資料庫撈對應時間點的資料
watch(selectedDate, (newDate) => {
  loadDataForDate(newDate)
})

// 頁面載入時執行
onMounted(async () => {
  await fetchAvailableDates()
})
</script>

<style scoped>
@import url('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css');

.container { 
  font-family: '微軟正黑體', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
  max-width: 1000px; 
}

.title { 
  font-weight: 800; 
  color: #2c3e50; 
  letter-spacing: -0.5px; 
}

.text-red { color: #D32F2F; font-weight: 800; }
.text-green { color: #388E3C; font-weight: 800; }

/* 分頁按鈕樣式 */
.tab-btn { 
  flex: 1; 
  padding: 16px; 
  background: none; 
  border: none; 
  font-size: 1.1rem; 
  font-weight: bold; 
  color: #6c757d; 
  cursor: pointer; 
  transition: all 0.2s ease-in-out; 
}

.tab-btn:hover { 
  background-color: #e9ecef; 
  color: #495057; 
}

.tab-btn.active { 
  color: #212529; 
  border-bottom: 4px solid #FF9800; 
  background-color: #ffffff; 
}
</style>
