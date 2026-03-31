package com.sienna.warmrecord

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.random.Random

private const val MAX_BOOK_CHARS = 100_000
private val json = Json { ignoreUnknownKeys = true }
private val ComponentActivity.dataStore by preferencesDataStore("sienna_store")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                SiennaApp(Storage(this))
            }
        }
    }
}

@Serializable
data class Book(
    val id: String,
    val title: String,
    val createdAt: String,
    val coverUri: String = "",
    val content: String = "",
    val readOnly: Boolean = false,
    val isFullPrompted: Boolean = false,
)

@Serializable
data class AppState(
    val books: List<Book> = emptyList(),
    val selectedBookId: String? = null,
    val weights: Map<String, Float> = emptyMap(),
)

@Serializable
data class SearchHit(
    val bookId: String,
    val bookTitle: String,
    val snippet: String,
    val charIndex: Int,
)

class Storage(private val activity: ComponentActivity) {
    private val stateKey = stringPreferencesKey("state")

    val state: Flow<AppState> = activity.dataStore.data.map { pref: Preferences ->
        pref[stateKey]?.let {
            runCatching { json.decodeFromString<AppState>(it) }.getOrElse { AppState() }
        } ?: AppState()
    }

    suspend fun save(state: AppState) {
        activity.dataStore.edit { pref ->
            pref[stateKey] = json.encodeToString(state)
        }
    }
}

enum class Tab { HOME, MIKKOHUB, CARE }

private val quotes = listOf(
    "你留在这里的每一个字，都在替今天轻轻发光。",
    "有些情绪不必立刻解决，先被好好看见就很好。",
    "慢一点也没关系，心是需要被温柔等待的。",
    "如果今天很重，那就先把一小块放在我这里。",
    "你写下的不是脆弱，是正在长出力量的证据。",
    "你一直都在前进，只是步伐刚好和心跳同步。",
)

@Composable
fun SiennaApp(storage: Storage) {
    val saved by storage.state.collectAsState(initial = AppState())
    val scope = rememberCoroutineScope()
    var currentTab by rememberSaveable { mutableStateOf(Tab.HOME) }
    var lockedQuote by rememberSaveable { mutableStateOf(quotes.random(Random(System.currentTimeMillis()))) }
    var jumpRequest by remember { mutableStateOf<Pair<String, Int>?>(null) }

    fun mutate(transform: (AppState) -> AppState) {
        scope.launch { storage.save(transform(saved)) }
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
        ) {
            Text("Sienna 💙", style = MaterialTheme.typography.headlineSmall, color = Color(0xFF1E3A8A))
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = currentTab == Tab.HOME, onClick = { currentTab = Tab.HOME }, label = { Text("home") })
                FilterChip(selected = currentTab == Tab.MIKKOHUB, onClick = { currentTab = Tab.MIKKOHUB }, label = { Text("Mikkohub") })
                FilterChip(selected = currentTab == Tab.CARE, onClick = { currentTab = Tab.CARE }, label = { Text("care") })
            }
            Spacer(Modifier.height(12.dp))

            when (currentTab) {
                Tab.HOME -> HomePanel(lockedQuote)
                Tab.MIKKOHUB -> MikkohubPanel(
                    state = saved,
                    jumpRequest = jumpRequest,
                    onJumpRequestConsumed = { jumpRequest = null },
                    onStateChange = { mutate { it } },
                    onBookSelect = { id -> mutate { it.copy(selectedBookId = id) } },
                    onBookCreate = {
                        val now = LocalDate.now().toString()
                        val id = "book-${System.currentTimeMillis()}"
                        val newBook = Book(id = id, title = "第 ${saved.books.size + 1} 卷", createdAt = now)
                        mutate { it.copy(books = listOf(newBook) + it.books, selectedBookId = id) }
                    },
                    onBookUpdate = { updated ->
                        mutate {
                            it.copy(books = it.books.map { b -> if (b.id == updated.id) updated else b })
                        }
                    },
                    onPromptCreateBook = {
                        val now = LocalDate.now().toString()
                        val id = "book-${System.currentTimeMillis()}"
                        val newBook = Book(id = id, title = "第 ${saved.books.size + 1} 卷", createdAt = now)
                        mutate { it.copy(books = listOf(newBook) + it.books, selectedBookId = id) }
                    },
                    onSearchHitClick = { hit ->
                        jumpRequest = hit.bookId to hit.charIndex
                        currentTab = Tab.MIKKOHUB
                        mutate { it.copy(selectedBookId = hit.bookId) }
                    }
                )
                Tab.CARE -> CarePanel(
                    weights = saved.weights,
                    onSaveWeight = { date, value -> mutate { it.copy(weights = it.weights + (date to value)) } }
                )
            }
        }
    }
}

@Composable
fun HomePanel(quote: String) {
    Column {
        Text("欢迎回家，Sienna💙", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF))) {
            Text(quote, modifier = Modifier.padding(14.dp), style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
fun MikkohubPanel(
    state: AppState,
    jumpRequest: Pair<String, Int>?,
    onJumpRequestConsumed: () -> Unit,
    onStateChange: (AppState) -> Unit,
    onBookSelect: (String) -> Unit,
    onBookCreate: () -> Unit,
    onBookUpdate: (Book) -> Unit,
    onPromptCreateBook: () -> Unit,
    onSearchHitClick: (SearchHit) -> Unit,
) {
    val selectedBook = state.books.firstOrNull { it.id == state.selectedBookId } ?: state.books.firstOrNull()
    var query by rememberSaveable { mutableStateOf("") }
    var hits by remember { mutableStateOf(emptyList<SearchHit>()) }
    var showLimitDialog by remember { mutableStateOf(false) }
    var editorText by remember(selectedBook?.id, selectedBook?.content) { mutableStateOf(selectedBook?.content.orEmpty()) }

    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Mikkohub · 文字信息储存库", style = MaterialTheme.typography.titleLarge)
            Button(onClick = onBookCreate) { Text("新建一卷") }
        }
        Spacer(Modifier.height(10.dp))

        if (state.books.isEmpty()) {
            Text("还没有卷册，点击“新建一卷”开始。")
            return
        }

        LazyColumn(modifier = Modifier.height(180.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.books) { book ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onBookSelect(book.id) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (book.id == selectedBook?.id) Color(0xFFEFF6FF) else Color(0xFFF8FAFC)
                    )
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Text(book.title, fontWeight = FontWeight.Bold)
                        Text("创建日期 ${book.createdAt}", style = MaterialTheme.typography.bodySmall)
                        Text("${book.content.length} / $MAX_BOOK_CHARS")
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        selectedBook?.let { book ->
            var title by remember(book.id, book.title) { mutableStateOf(book.title) }
            var readOnly by remember(book.id, book.readOnly) { mutableStateOf(book.readOnly) }
            val launcher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
                uri?.let {
                    onBookUpdate(book.copy(coverUri = it.toString(), title = title, readOnly = readOnly, content = editorText))
                }
            }

            OutlinedTextField(
                value = title,
                onValueChange = {
                    title = it
                    onBookUpdate(book.copy(title = it.ifBlank { "未命名卷册" }, readOnly = readOnly, content = editorText))
                },
                label = { Text("卷册名") },
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("仅阅读模式")
                Spacer(Modifier.width(8.dp))
                Button(onClick = {
                    readOnly = !readOnly
                    onBookUpdate(book.copy(readOnly = readOnly, title = title, content = editorText))
                }) { Text(if (readOnly) "已开启" else "已关闭") }
                Spacer(Modifier.width(8.dp))
                Button(onClick = { launcher.launch("image/*") }) { Text("选择封面") }
            }

            if (book.coverUri.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                AsyncImage(
                    model = book.coverUri,
                    contentDescription = "封面",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
            }

            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = editorText,
                onValueChange = {
                    editorText = it
                    var prompted = book.isFullPrompted
                    if (it.length >= MAX_BOOK_CHARS && !prompted) {
                        prompted = true
                        showLimitDialog = true
                    }
                    onBookUpdate(book.copy(content = it, title = title, readOnly = readOnly, isFullPrompted = prompted))
                },
                readOnly = readOnly,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                label = { Text("正文 ${editorText.length} / $MAX_BOOK_CHARS") },
            )

            LaunchedEffect(jumpRequest, book.id, editorText) {
                if (jumpRequest != null && jumpRequest.first == book.id) {
                    onJumpRequestConsumed()
                }
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("全局搜索", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), label = { Text("输入关键词") })
        Spacer(Modifier.height(8.dp))
        Button(onClick = {
            hits = searchBooks(state.books, query)
        }) { Text("搜索") }

        Column(modifier = Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            hits.forEach { hit ->
                Card(modifier = Modifier.fillMaxWidth().clickable { onSearchHitClick(hit) }) {
                    Text("[${hit.bookTitle}] ${hit.snippet}", modifier = Modifier.padding(10.dp))
                }
            }
        }
    }

    if (showLimitDialog) {
        AlertDialog(
            onDismissRequest = { showLimitDialog = false },
            title = { Text("提示") },
            text = { Text("sienna💙这本已经很厚了，要不要开新卷?") },
            confirmButton = {
                TextButton(onClick = {
                    showLimitDialog = false
                    onPromptCreateBook()
                }) { Text("要") }
            },
            dismissButton = {
                TextButton(onClick = { showLimitDialog = false }) { Text("暂时不要") }
            }
        )
    }
}

private fun searchBooks(books: List<Book>, query: String): List<SearchHit> {
    val q = query.trim()
    if (q.isEmpty()) return emptyList()
    val result = mutableListOf<SearchHit>()
    books.forEach { book ->
        var from = 0
        while (from < book.content.length) {
            val idx = book.content.indexOf(q, from)
            if (idx == -1) break
            val start = (idx - 16).coerceAtLeast(0)
            val end = (idx + q.length + 16).coerceAtMost(book.content.length)
            val snippet = (if (start > 0) "..." else "") + book.content.substring(start, end) + (if (end < book.content.length) "..." else "")
            result += SearchHit(book.id, book.title, snippet, idx)
            from = idx + q.length
            if (result.size > 100) return result
        }
    }
    return result
}

@Composable
fun CarePanel(weights: Map<String, Float>, onSaveWeight: (String, Float) -> Unit) {
    val today = remember { LocalDate.now(ZoneId.systemDefault()).format(DateTimeFormatter.ISO_DATE) }
    var input by rememberSaveable { mutableStateOf(weights[today]?.toString().orEmpty()) }
    var status by remember { mutableStateOf("") }

    Column {
        Text("care · 健康记录", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                label = { Text("今天体重 (kg)") },
                modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.width(8.dp))
            Button(onClick = {
                val value = input.toFloatOrNull()
                if (value == null || value <= 0f) {
                    status = "请输入有效体重"
                } else {
                    onSaveWeight(today, value)
                    status = "已记录 $today: $value kg"
                }
            }) { Text("保存") }
        }
        if (status.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(status)
        }
        Spacer(Modifier.height(16.dp))
        WeightChart(weights = weights)
    }
}

@Composable
fun WeightChart(weights: Map<String, Float>) {
    val sorted = weights.entries.sortedBy { it.key }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
            .background(Color.White, RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        if (sorted.isEmpty()) {
            Text("还没有体重记录", color = Color.Gray)
            return
        }

        Canvas(modifier = Modifier.fillMaxSize()) {
            val minY = sorted.minOf { it.value }.minus(0.5f)
            val maxY = sorted.maxOf { it.value }.plus(0.5f)
            val width = size.width
            val height = size.height
            val start = LocalDate.parse(sorted.first().key)
            val end = LocalDate.parse(sorted.last().key)
            val totalDays = (end.toEpochDay() - start.toEpochDay()).toFloat().coerceAtLeast(1f)

            var previous: Pair<LocalDate, Float>? = null
            sorted.forEach { entry ->
                val day = LocalDate.parse(entry.key)
                val x = ((day.toEpochDay() - start.toEpochDay()) / totalDays) * width
                val yRatio = (entry.value - minY) / (maxY - minY).coerceAtLeast(0.0001f)
                val y = height - yRatio * height

                previous?.let { (prevDay, prevYValue) ->
                    val gap = day.toEpochDay() - prevDay.toEpochDay()
                    if (gap == 1L) {
                        val prevX = ((prevDay.toEpochDay() - start.toEpochDay()) / totalDays) * width
                        val prevRatio = (prevYValue - minY) / (maxY - minY).coerceAtLeast(0.0001f)
                        val prevY = height - prevRatio * height
                        drawLine(Color(0xFF2563EB), Offset(prevX, prevY), Offset(x, y), strokeWidth = 4f)
                    }
                }
                drawCircle(Color(0xFF1D4ED8), radius = 6f, center = Offset(x, y))
                previous = day to entry.value
            }
        }
    }
}
