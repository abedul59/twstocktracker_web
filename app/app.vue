<template>
  <div class="container py-4">
    <h1 class="title text-center">📈 台股資金流向 Web 儀表板</h1>
    
    <div class="upload-section card shadow-sm p-4 mb-4">
      <div class="d-flex align-items-center gap-3">
        <input type="file" class="form-control w-50" accept=".json" @change="handleFileUpload" />
        <button class="btn btn-primary" @click="uploadToSupabase" :disabled="!jsonData || isUploading">
          {{ isUploading ? '上傳至資料庫中...' : '匯入 JSON 並寫入 Supabase' }}
        </button>
      </div>
      <p v-if="uploadStatus" class="status-msg mt-3 mb-0">{{ uploadStatus }}</p>
    </div>

    <div v-if="statsData.length > 0" class="data-section card shadow-sm">
      
      <div class="tabs-header d-flex border-bottom">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === '上市' }" 
          @click="activeTab = '上市'">
          上市類股
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === '上櫃' }" 
          @click="activeTab = '上櫃'">
          上櫃類股
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === '興櫃' }" 
          @click="activeTab = '興櫃'">
          興櫃類股
        </button>
      </div>

      <div class="p-3">
        <table class="table table-hover">
          <thead class="table-dark">
            <tr>
              <th>市場</th>
              <th>類股名稱</th>
              <th>平均漲跌幅</th>
              <th>平均股價 (元)</th>
              <th>平均成交量 (張)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in filteredStats" :key="stat.id">
              <td>
                <span :class="['badge', getBadgeClass(stat.market)]">
                  {{ stat.market }}
                </span>
              </td>
              <td>{{ stat.category }}</td>
              <td :class="stat.avg_change_pct.includes('-') ? 'text-green' : 'text-red'">
                {{ stat.avg_change_pct }}
              </td>
              <td>{{ stat.avg_price }}</td>
              <td>{{ stat.avg_vol }}</td>
            </tr>
            <tr v-if="filteredStats.length === 0">
              <td colspan="5" class="text-center py-3 text-muted">此市場暫無資料</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
const supabase = useSupabaseClient()

const jsonData = ref(null)
const uploadStatus = ref('')
const isUploading = ref(false)
const statsData = ref([])

// 預設選擇的 Tab
const activeTab = ref('上市')

// 根據目前選擇的 Tab 過濾資料
const filteredStats = computed(() => {
  return statsData.value.filter(stat => stat.market === activeTab.value)
})

// 處理選擇檔案並讀取 JSON
const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      jsonData.value = JSON.parse(e.target.result)
      uploadStatus.value = `成功讀取 ${jsonData.value.date} 數據，準備上傳。`
    } catch (err) {
      uploadStatus.value = "JSON 解析失敗！請確認檔案格式。"
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
    // 實務上您可以根據日期刪除，這裡為求展示直接清空舊的類股統計資料
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
    
    const { error: statsError } = await supabase.from('category_stats').insert(statsPayload)
    if (statsError) throw statsError

    uploadStatus.value = '資料上傳成功！正在重新渲染畫面...'
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
    
  if (!error && data) {
    // 重新排序：將百分比字串轉換為數字進行遞減排序
    statsData.value = data.sort((a, b) => {
      const valA = parseFloat(a.avg_change_pct.replace('%', '')) || 0;
      const valB = parseFloat(b.avg_change_pct.replace('%', '')) || 0;
      return valB - valA;
    });
  }
}

// 根據市場給予不同的 Tag 顏色
const getBadgeClass = (market) => {
  if (market === '上市') return 'bg-danger';
  if (market === '上櫃') return 'bg-primary';
  if (market === '興櫃') return 'bg-success';
  return 'bg-secondary';
}

onMounted(() => {
  fetchStatsFromSupabase()
})
</script>

<style scoped>
/* 引用基本的 Bootstrap 工具樣式 (您也可以在 nuxt.config 中全局引入 bootstrap css) */
@import url('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css');

.container {
  font-family: '微軟正黑體', sans-serif;
  max-width: 900px;
}
.title {
  font-weight: bold;
  color: #333;
  margin-bottom: 30px;
}
.status-msg {
  color: #1976D2;
  font-weight: 600;
}
.text-red {
  color: #D32F2F;
  font-weight: bold;
}
.text-green {
  color: #388E3C;
  font-weight: bold;
}

/* Tab 按鈕樣式 */
.tabs-header {
  background-color: #f8f9fa;
}
.tab-btn {
  flex: 1;
  padding: 15px;
  background: none;
  border: none;
  font-size: 16px;
  font-weight: bold;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.3s;
}
.tab-btn:hover {
  background-color: #e9ecef;
}
.tab-btn.active {
  color: #0d6efd;
  border-bottom: 3px solid #0d6efd;
  background-color: #fff;
}
</style>