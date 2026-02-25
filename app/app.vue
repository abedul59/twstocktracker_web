<template>
  <div class="container">
    <h1>台股資金流向 Web 儀表板</h1>
    
    <div class="upload-section">
      <input type="file" accept=".json" @change="handleFileUpload" />
      <button @click="uploadToSupabase" :disabled="!jsonData || isUploading">
        {{ isUploading ? '上傳至資料庫中...' : '匯入 JSON 並寫入 Supabase' }}
      </button>
      <p v-if="uploadStatus" class="status">{{ uploadStatus }}</p>
    </div>

    <div v-if="statsData.length > 0" class="data-section">
      <h2>📈 類股平均數據總覽 (來自 Supabase)</h2>
      <table>
        <thead>
          <tr>
            <th>市場</th>
            <th>類股名稱</th>
            <th>平均漲跌幅</th>
            <th>平均股價</th>
            <th>平均成交量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in statsData" :key="stat.id">
            <td>{{ stat.market }}</td>
            <td>{{ stat.category }}</td>
            <td :class="stat.avg_change_pct.includes('-') ? 'green' : 'red'">
              {{ stat.avg_change_pct }}
            </td>
            <td>{{ stat.avg_price }}</td>
            <td>{{ stat.avg_vol }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const supabase = useSupabaseClient()

const jsonData = ref(null)
const uploadStatus = ref('')
const isUploading = ref(false)
const statsData = ref([])

// 處理選擇檔案並讀取 JSON
const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      jsonData.value = JSON.parse(e.target.result)
      uploadStatus.value = `成功讀取 JSON，包含 ${jsonData.value.details.length} 筆明細，準備上傳。`
    } catch (err) {
      uploadStatus.value = "JSON 解析失敗！"
    }
  }
  reader.readAsText(file)
}

// 將資料寫入 Supabase
const uploadToSupabase = async () => {
  if (!jsonData.value) return
  isUploading.value = true
  uploadStatus.value = '正在清空舊資料並上傳新資料...'
  
  const date = jsonData.value.date
  
  try {
    // 為了展示方便，我們先清空舊資料 (實務上可根據 date 做 upsert)
    await supabase.from('stock_details').delete().neq('id', 0)
    await supabase.from('category_stats').delete().neq('id', 0)
    
    // 準備 stats 寫入格式
    const statsPayload = jsonData.value.stats.map(s => ({
      date: date,
      market: s.market,
      category: s.category,
      avg_change_pct: s.avg_change_pct,
      avg_price: s.avg_price,
      avg_vol: s.avg_vol
    }))
    
    // 寫入 Supabase
    const { error: statsError } = await supabase.from('category_stats').insert(statsPayload)
    if (statsError) throw statsError

    uploadStatus.value = '資料上傳成功！正在重新讀取...'
    await fetchStatsFromSupabase()
    
  } catch (error) {
    uploadStatus.value = `上傳發生錯誤: ${error.message}`
  } finally {
    isUploading.value = false
  }
}

// 從 Supabase 抓取資料並呈現
const fetchStatsFromSupabase = async () => {
  const { data, error } = await supabase
    .from('category_stats')
    .select('*')
    .order('avg_change_pct', { ascending: false }) // 依照漲跌幅排序
    
  if (!error && data) {
    statsData.value = data
  }
}

// 頁面載入時自動抓取既有資料
onMounted(() => {
  fetchStatsFromSupabase()
})
</script>

<style scoped>
.container { font-family: '微軟正黑體', sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
.upload-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
button { padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { background: #cccccc; cursor: not-allowed; }
.status { color: #2196F3; font-weight: bold; margin-top: 10px; }
table { width: 100%; border-collapse: collapse; margin-top: 15px; }
th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
th { background-color: #333; color: white; }
.red { color: #d32f2f; font-weight: bold; }
.green { color: #388e3c; font-weight: bold; }
</style>