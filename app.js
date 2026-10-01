// Deutsch Portal Application Logic
(function() {
  function getVocab() { return (typeof window !== 'undefined' && window.VOCAB_DATA) ? window.VOCAB_DATA : []; }
  function getGrammar() { return (typeof window !== 'undefined' && window.GRAMMAR_DATA) ? window.GRAMMAR_DATA : {}; }
  function getQuizzes() { return (typeof window !== 'undefined' && window.QUIZ_DATA) ? window.QUIZ_DATA : []; }
  function getJournals() { return (typeof window !== 'undefined' && window.JOURNAL_DATA) ? window.JOURNAL_DATA : []; }

  function safeGetItem(key, fallback) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        return val !== null ? val : fallback;
      }
    } catch (e) {
      console.warn('localStorage not accessible:', e);
    }
    return fallback;
  }

  function safeSetItem(key, val) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  }

  class DeutschPortalApp {
    constructor() {
      this.currentTab = 'vocab'; // 'vocab' | 'grammar' | 'quiz' | 'journal'
      this.grammarSubtab = 'cases'; // 'cases' | 'preps' | 'modals' | 'shifts' | 'syntax' | 'perfekt' | 'time'
      
      const vocabData = getVocab();

      // Vocab State
      this.searchQuery = '';
      this.selectedCategory = 'All';
      this.selectedDate = 'All';
      this.selectedGender = 'All'; // 'All' | 'der' | 'die' | 'das' | 'plural'
      this.showOnlyStarred = false;
      this.vocabPage = 1;
      this.vocabPerPage = 36;
      
      // Flashcard State
      this.flashcards = [...vocabData];
      this.currentFlashcardIdx = 0;
      this.isCardFlipped = false;
      this.flashcardFilter = 'All';

      // Quiz State
      this.quizType = 'modal'; // 'modal' | 'gender'
      this.currentQuizIdx = 0;
      this.quizScore = 0;
      this.quizAnswered = false;
      this.selectedOption = null;
      this.streak = 0;

      // Gender Guesser State
      this.genderNouns = vocabData.filter(v => v.article && ['der', 'die', 'das'].includes(v.article));
      this.currentGenderIdx = 0;
      this.genderScore = 0;
      this.genderTotal = 0;

      // Journal State
      this.activeJournalId = 'davos';

      // Persistent storage with fallbacks
      try {
        this.userNotes = JSON.parse(safeGetItem('deutsch_user_notes', '[]'));
        this.starredIds = new Set(JSON.parse(safeGetItem('deutsch_starred_ids', '[]')));
        this.learnedIds = new Set(JSON.parse(safeGetItem('deutsch_learned_ids', '[]')));
      } catch (e) {
        this.userNotes = [];
        this.starredIds = new Set();
        this.learnedIds = new Set();
      }

      let defaultTheme = 'light';
      try {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          defaultTheme = 'dark';
        }
      } catch (e) {}
      this.theme = safeGetItem('deutsch_theme', defaultTheme);
      this.speechRate = parseFloat(safeGetItem('deutsch_speech_rate', '0.95'));

      // Case visualizer interactive state
      this.selectedCase = 'Nominativ';
      this.selectedGenderInCase = 'm';

      // Sentence V2 interactive state
      this.v2Position1 = 'Time'; // 'Time' | 'Subject' | 'Object'

      // Preposition interactive state
      this.prepTwoWayMode = 'movement'; // 'movement' (Akk) | 'position' (Dat)

      // Init
      this.init();
    }

    init() {
      this.applyTheme();
      this.updateStarredCounter();
      this.setupKeyboardShortcuts();
      this.render();
    }

    // --- Theme Management ---
    applyTheme() {
      if (typeof document === 'undefined') return;
      if (this.theme === 'dark') {
        document.documentElement.classList.add('dark');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.setAttribute('data-lucide', 'sun');
      } else {
        document.documentElement.classList.remove('dark');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.setAttribute('data-lucide', 'moon');
      }
      this.refreshIcons();
    }

    refreshIcons() {
      try {
        if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      } catch (e) {
        console.warn('Lucide icon refresh failed:', e);
      }
    }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('deutsch_theme', this.theme);
    this.applyTheme();
  }

  // --- Speech Engine ---
  setSpeechRate(rate) {
    this.speechRate = parseFloat(rate);
    localStorage.setItem('deutsch_speech_rate', this.speechRate);
  }

  speak(text, btnElement = null) {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel(); // Stop any ongoing speech

    const cleanText = text.replace(/^[→\-*]\s*/, '').split('=')[0].trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'de-DE';
    utterance.rate = this.speechRate;

    // Try to find a high quality German voice
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(v => v.lang.startsWith('de') && (v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Natural') || v.name.includes('Anna') || v.name.includes('Petra')));
    if (germanVoice) {
      utterance.voice = germanVoice;
    }

    if (btnElement) {
      btnElement.classList.add('is-speaking');
      utterance.onend = () => btnElement.classList.remove('is-speaking');
      utterance.onerror = () => btnElement.classList.remove('is-speaking');
    }

    window.speechSynthesis.speak(utterance);
  }

  // --- Starred & Progress Management ---
  toggleStar(id, event) {
    if (event) event.stopPropagation();
    if (this.starredIds.has(id)) {
      this.starredIds.delete(id);
    } else {
      this.starredIds.add(id);
    }
    localStorage.setItem('deutsch_starred_ids', JSON.stringify([...this.starredIds]));
    this.updateStarredCounter();
    this.render();
  }

  updateStarredCounter() {
    const counterEl = document.getElementById('starred-counter');
    if (!counterEl) return;
    const count = this.starredIds.size;
    if (count > 0) {
      counterEl.textContent = count;
      counterEl.classList.remove('hidden');
    } else {
      counterEl.classList.add('hidden');
    }
  }

  toggleStarredFilter() {
    this.showOnlyStarred = !this.showOnlyStarred;
    this.setTab('vocab');
  }

  toggleLearned(id) {
    if (this.learnedIds.has(id)) {
      this.learnedIds.delete(id);
    } else {
      this.learnedIds.add(id);
    }
    localStorage.setItem('deutsch_learned_ids', JSON.stringify([...this.learnedIds]));
    this.render();
  }

  // --- Navigation & Routing ---
  setTab(tab) {
    this.currentTab = tab;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setGrammarSubtab(subtab) {
    this.grammarSubtab = subtab;
    this.render();
  }

  toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (this.currentTab === 'quiz' && this.quizType === 'flashcard') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.code === 'ArrowRight') {
          this.nextFlashcard();
        } else if (e.code === 'ArrowLeft') {
          this.prevFlashcard();
        }
      }
    });
  }

  // --- Render Orchestrator ---
  render() {
    this.updateNavUI();
    const container = document.getElementById('app-container');
    if (!container) return;

    if (this.currentTab === 'vocab') {
      container.innerHTML = this.renderVocabTab();
    } else if (this.currentTab === 'grammar') {
      container.innerHTML = this.renderGrammarTab();
    } else if (this.currentTab === 'quiz') {
      container.innerHTML = this.renderQuizTab();
    } else if (this.currentTab === 'journal') {
      container.innerHTML = this.renderJournalTab();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  updateNavUI() {
    const tabs = ['vocab', 'grammar', 'quiz', 'journal'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-${t}`);
      if (!btn) return;
      if (this.currentTab === t) {
        btn.className = "px-3.5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-2 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 shadow-sm";
      } else {
        btn.className = "px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";
      }
    });

    const starBtn = document.getElementById('btn-starred-filter');
    if (starBtn) {
      if (this.showOnlyStarred) {
        starBtn.classList.add('bg-amber-100', 'text-amber-700', 'dark:bg-amber-950/50', 'dark:text-amber-300', 'border-amber-300');
      } else {
        starBtn.classList.remove('bg-amber-100', 'text-amber-700', 'dark:bg-amber-950/50', 'dark:text-amber-300', 'border-amber-300');
      }
    }
  }

  // ==========================================
  // PILLAR 1: VOCABULARY EXPLORER
  // ==========================================
  getFilteredVocab() {
    return VOCAB_DATA.filter(item => {
      // Starred filter
      if (this.showOnlyStarred && !this.starredIds.has(item.id)) return false;

      // Category filter
      if (this.selectedCategory !== 'All' && item.category !== this.selectedCategory) return false;

      // Date filter
      if (this.selectedDate !== 'All' && item.date !== this.selectedDate) return false;

      // Gender filter
      if (this.selectedGender !== 'All') {
        if (this.selectedGender === 'plural') {
          if (item.gender !== 'plural') return false;
        } else {
          if (item.article !== this.selectedGender) return false;
        }
      }

      // Search Query
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const deMatch = item.german.toLowerCase().includes(q);
        const enMatch = item.english.toLowerCase().includes(q);
        const exMatch = item.examples.some(e => e.de.toLowerCase().includes(q) || e.en.toLowerCase().includes(q));
        const noteMatch = item.notes.some(n => n.toLowerCase().includes(q));
        if (!deMatch && !enMatch && !exMatch && !noteMatch) return false;
      }

      return true;
    });
  }

  renderVocabTab() {
    const categories = ['All', 'Food & Dining', 'Work & Tech', 'Travel & Switzerland', 'Family & People', 'Home & Daily Life', 'Feelings & Health', 'Everyday Expressions'];
    
    // Collect unique dates
    const allDates = ['All', ...new Set(VOCAB_DATA.map(v => v.date).filter(Boolean))];

    const filtered = this.getFilteredVocab();
    const paginated = filtered.slice(0, this.vocabPage * this.vocabPerPage);
    const hasMore = paginated.length < filtered.length;

    return `
      <div class="space-y-6">
        
        <!-- Search & Control Banner -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          
          <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            <!-- Search Bar -->
            <div class="relative flex-1">
              <i data-lucide="search" class="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="text" 
                value="${this.searchQuery}" 
                oninput="app.setSearchQuery(this.value)" 
                placeholder="Search across 870+ German words, English meanings, examples..." 
                class="w-full pl-11 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
              ${this.searchQuery ? `
                <button onclick="app.setSearchQuery('')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : ''}
            </div>

            <!-- Date Selector Dropdown -->
            <div class="flex items-center space-x-2">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:inline">Lesson:</span>
              <select 
                onchange="app.setSelectedDate(this.value)"
                class="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                ${allDates.map(d => `<option value="${d}" ${this.selectedDate === d ? 'selected' : ''}>${d === 'All' ? '📅 All Lesson Dates (50)' : '📅 ' + d}</option>`).join('')}
              </select>
            </div>

            <!-- Gender Filters -->
            <div class="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button onclick="app.setSelectedGender('All')" class="px-2.5 py-1 text-xs font-semibold rounded-lg transition ${this.selectedGender === 'All' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">All</button>
              <button onclick="app.setSelectedGender('der')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${this.selectedGender === 'der' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'}">der</button>
              <button onclick="app.setSelectedGender('die')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${this.selectedGender === 'die' ? 'bg-red-600 text-white shadow-sm' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'}">die</button>
              <button onclick="app.setSelectedGender('das')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${this.selectedGender === 'das' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}">das</button>
              <button onclick="app.setSelectedGender('plural')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${this.selectedGender === 'plural' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'}">die pl.</button>
            </div>

          </div>

          <!-- Category Pill Filter Tabs -->
          <div class="flex items-center space-x-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            ${categories.map(cat => {
              const active = this.selectedCategory === cat;
              return `
                <button 
                  onclick="app.setSelectedCategory('${cat}')" 
                  class="whitespace-nowrap px-3 py-1.5 rounded-full font-medium transition ${active 
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}"
                >
                  ${cat}
                </button>
              `;
            }).join('')}
          </div>

          <!-- Active Filter Stats / Reset -->
          <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
            <div>
              Showing <span class="font-bold text-slate-800 dark:text-slate-200">${paginated.length}</span> of <span class="font-bold text-slate-800 dark:text-slate-200">${filtered.length}</span> entries 
              ${filtered.length < VOCAB_DATA.length ? `(filtered from ${VOCAB_DATA.length} total)` : ''}
              ${this.showOnlyStarred ? '<span class="ml-2 font-semibold text-amber-500">⭐ Starred Only</span>' : ''}
            </div>

            ${(this.searchQuery || this.selectedCategory !== 'All' || this.selectedDate !== 'All' || this.selectedGender !== 'All' || this.showOnlyStarred) ? `
              <button onclick="app.resetVocabFilters()" class="text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1 font-semibold">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                <span>Reset Filters</span>
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Vocabulary Cards Grid -->
        ${paginated.length === 0 ? `
          <div class="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
              <i data-lucide="search-x" class="w-6 h-6"></i>
            </div>
            <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">No matching words found</h3>
            <p class="text-sm text-slate-500 max-w-sm mx-auto">Try adjusting your search query, clearing filters, or switching lesson dates.</p>
            <button onclick="app.resetVocabFilters()" class="px-4 py-2 rounded-xl bg-brand-600 text-white font-medium text-xs hover:bg-brand-700 transition">
              Reset All Filters
            </button>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${paginated.map(item => this.renderVocabCard(item)).join('')}
          </div>
        `}

        <!-- Load More Button -->
        ${hasMore ? `
          <div class="text-center py-4">
            <button 
              onclick="app.loadMoreVocab()" 
              class="px-6 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-400 font-semibold text-sm border border-slate-200 dark:border-slate-800 shadow-sm transition inline-flex items-center space-x-2"
            >
              <span>Load More (${filtered.length - paginated.length} remaining)</span>
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </button>
          </div>
        ` : ''}

      </div>
    `;
  }

  renderVocabCard(item) {
    const isStarred = this.starredIds.has(item.id);
    const isLearned = this.learnedIds.has(item.id);

    // Gender styling
    let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
    if (item.article === 'der') badgeClass = 'badge-masculine font-bold';
    else if (item.article === 'die' && item.gender !== 'plural') badgeClass = 'badge-feminine font-bold';
    else if (item.article === 'das') badgeClass = 'badge-neuter font-bold';
    else if (item.gender === 'plural' || item.article === 'die (pl)') badgeClass = 'badge-plural font-bold';

    return `
      <div class="group bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-3">
        
        <div>
          <!-- Header: Gender badge, Date, and Star -->
          <div class="flex items-center justify-between text-xs mb-2">
            <div class="flex items-center space-x-2">
              ${item.article ? `
                <span class="px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wide border ${badgeClass}">
                  ${item.article}
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                  phrase
                </span>
              `}
              <span class="text-slate-400 text-[11px]">📅 ${item.date}</span>
            </div>

            <div class="flex items-center space-x-1">
              <button 
                onclick="app.toggleStar(${item.id}, event)" 
                class="p-1 rounded-md text-slate-400 hover:text-amber-500 transition ${isStarred ? 'text-amber-500 fill-amber-500' : ''}"
                title="${isStarred ? 'Remove from favorites' : 'Add to favorites'}"
              >
                <i data-lucide="star" class="w-4 h-4 ${isStarred ? 'fill-amber-500 text-amber-500' : ''}"></i>
              </button>
            </div>
          </div>

          <!-- Main German Word & Audio Button -->
          <div class="flex items-start justify-between">
            <div class="space-y-0.5">
              <h4 class="text-lg font-bold text-slate-900 dark:text-slate-50 tracking-tight flex items-center flex-wrap gap-1">
                <span>${item.german}</span>
                ${item.plural ? `<span class="text-xs text-amber-600 dark:text-amber-400 font-normal">(${item.plural})</span>` : ''}
              </h4>
              <p class="text-sm text-slate-600 dark:text-slate-300 font-medium">
                ${item.english}
              </p>
            </div>

            <button 
              onclick="app.speak('${item.german.replace(/'/g, "\\'")}', this)" 
              class="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:hover:bg-brand-900/80 dark:text-brand-300 transition shrink-0 ml-2" 
              title="Listen to German pronunciation"
            >
              <i data-lucide="volume-2" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Notes / Conjugation tips -->
          ${item.notes && item.notes.length > 0 ? `
            <div class="mt-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              ${item.notes.map(n => `<div class="flex items-center space-x-1.5"><i data-lucide="info" class="w-3 h-3 text-brand-500 shrink-0"></i><span>${n}</span></div>`).join('')}
            </div>
          ` : ''}

          <!-- Example Sentences -->
          ${item.examples && item.examples.length > 0 ? `
            <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <i data-lucide="message-square" class="w-3 h-3"></i>
                <span>Lesson Example</span>
              </div>
              ${item.examples.slice(0, 2).map(ex => `
                <div class="text-xs space-y-0.5 group/ex">
                  <div class="flex items-center justify-between text-slate-800 dark:text-slate-200 font-medium">
                    <span>${ex.de}</span>
                    <button onclick="app.speak('${ex.de.replace(/'/g, "\\'")}', this)" class="text-slate-400 hover:text-brand-500 p-0.5 transition" title="Speak sentence">
                      <i data-lucide="volume-2" class="w-3 h-3"></i>
                    </button>
                  </div>
                  ${ex.en ? `<div class="text-slate-500 dark:text-slate-400 text-[11px]">${ex.en}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

        </div>

        <!-- Footer Tag -->
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <span class="inline-flex items-center space-x-1">
            <i data-lucide="tag" class="w-3 h-3 text-slate-400"></i>
            <span>${item.category}</span>
          </span>
          
          <button 
            onclick="app.toggleLearned(${item.id})" 
            class="hover:underline flex items-center space-x-1 ${isLearned ? 'text-emerald-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}"
          >
            <i data-lucide="${isLearned ? 'check-circle' : 'circle'}" class="w-3.5 h-3.5"></i>
            <span>${isLearned ? 'Mastered' : 'Mark learned'}</span>
          </button>
        </div>

      </div>
    `;
  }

  setSearchQuery(q) {
    this.searchQuery = q;
    this.vocabPage = 1;
    this.render();
  }

  setSelectedCategory(cat) {
    this.selectedCategory = cat;
    this.vocabPage = 1;
    this.render();
  }

  setSelectedDate(date) {
    this.selectedDate = date;
    this.vocabPage = 1;
    this.render();
  }

  setSelectedGender(g) {
    this.selectedGender = g;
    this.vocabPage = 1;
    this.render();
  }

  resetVocabFilters() {
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.selectedDate = 'All';
    this.selectedGender = 'All';
    this.showOnlyStarred = false;
    this.vocabPage = 1;
    this.render();
  }

  loadMoreVocab() {
    this.vocabPage += 1;
    this.render();
  }

  // ==========================================
  // PILLAR 2: GRAMMAR STUDIO
  // ==========================================
  renderGrammarTab() {
    return `
      <div class="space-y-6">
        
        <!-- Grammar Module Subtab Navigation -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center space-x-1 overflow-x-auto no-scrollbar">
          <button onclick="app.setGrammarSubtab('cases')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'cases' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            🏷️ Articles &amp; 4 Cases
          </button>

          <button onclick="app.setGrammarSubtab('preps')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'preps' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            📍 Preposition Matrix
          </button>

          <button onclick="app.setGrammarSubtab('modals')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'modals' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            ⚡ Modalverben
          </button>

          <button onclick="app.setGrammarSubtab('shifts')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'shifts' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            🔄 Vowel Shifts &amp; Prefixes
          </button>

          <button onclick="app.setGrammarSubtab('syntax')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'syntax' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            📐 Word Order (V2 &amp; Nebensatz)
          </button>

          <button onclick="app.setGrammarSubtab('perfekt')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'perfekt' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            ⏳ Perfekt (Past Tense)
          </button>

          <button onclick="app.setGrammarSubtab('time')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${this.grammarSubtab === 'time' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
            ⏰ Time, Numbers &amp; Directions
          </button>
        </div>

        <!-- Render Subtab Content -->
        <div class="transition-all duration-150">
          ${this.renderGrammarSubtabContent()}
        </div>

      </div>
    `;
  }

  renderGrammarSubtabContent() {
    switch (this.grammarSubtab) {
      case 'cases': return this.renderCasesStudio();
      case 'preps': return this.renderPrepositionsStudio();
      case 'modals': return this.renderModalsStudio();
      case 'shifts': return this.renderShiftsAndPrefixesStudio();
      case 'syntax': return this.renderSyntaxStudio();
      case 'perfekt': return this.renderPerfektStudio();
      case 'time': return this.renderTimeAndNumbersStudio();
      default: return this.renderCasesStudio();
    }
  }

  // --- Subtab 1: Articles & Cases ---
  renderCasesStudio() {
    const cases = GRAMMAR_DATA.articles_cases.cases;
    const activeCaseObj = cases.find(c => c.case === this.selectedCase) || cases[0];

    return `
      <div class="space-y-6">
        
        <!-- Case Explainer Hero -->
        <div class="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-blue-200">
                Grammatik-Cheatsheet Hanan
              </span>
              <h2 class="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">The 4 German Cases (Die vier Fälle)</h2>
              <p class="text-sm sm:text-base text-blue-100 max-w-2xl mt-1">
                German cases indicate the function of a noun in a sentence (Subject, Direct Object, Indirect Recipient, or Possession).
              </p>
            </div>

            <!-- Case Quick Switcher -->
            <div class="flex flex-wrap gap-2">
              ${cases.map(c => `
                <button 
                  onclick="app.selectCase('${c.case}')" 
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${this.selectedCase === c.case 
                    ? 'bg-white text-blue-900 scale-105' 
                    : 'bg-white/10 text-white hover:bg-white/20'}"
                >
                  ${c.case}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Active Case Description Card -->
          <div class="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <span class="text-blue-300 font-semibold uppercase text-[11px] block">Role in Sentence</span>
              <span class="font-bold text-white text-base">${activeCaseObj.role}</span>
            </div>
            <div>
              <span class="text-blue-300 font-semibold uppercase text-[11px] block">Key Question</span>
              <span class="font-bold text-white text-base">${activeCaseObj.question}</span>
            </div>
            <div>
              <span class="text-blue-300 font-semibold uppercase text-[11px] block">Description</span>
              <span class="text-blue-100">${activeCaseObj.description}</span>
            </div>
          </div>
        </div>

        <!-- Master Declension Table -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Master Article Declension Matrix</h3>
              <p class="text-xs text-slate-500">Notice how only masculine changes in Akkusativ, while Dativ alters masculine, neuter, feminine and adds -n to plural!</p>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th class="py-3 px-4">Case</th>
                  <th class="py-3 px-4 text-blue-600 dark:text-blue-400">Maskulin (m)</th>
                  <th class="py-3 px-4 text-red-600 dark:text-red-400">Feminin (f)</th>
                  <th class="py-3 px-4 text-emerald-600 dark:text-emerald-400">Neutral (n)</th>
                  <th class="py-3 px-4 text-amber-600 dark:text-amber-400">Plural (pl)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${cases.map(c => {
                  const isActive = this.selectedCase === c.case;
                  const rowBg = isActive ? 'bg-brand-50/70 dark:bg-brand-950/40 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
                  return `
                    <tr class="${rowBg} transition cursor-pointer" onclick="app.selectCase('${c.case}')">
                      <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <span>${c.case}</span>
                        ${isActive ? '<span class="w-2 h-2 rounded-full bg-brand-500"></span>' : ''}
                      </td>
                      <td class="py-3.5 px-4 text-blue-700 dark:text-blue-300 font-mono">
                        <span class="font-bold">${c.definite.m}</span> / ${c.indefinite.m} / ${c.negative.m}
                      </td>
                      <td class="py-3.5 px-4 text-red-700 dark:text-red-300 font-mono">
                        <span class="font-bold">${c.definite.f}</span> / ${c.indefinite.f} / ${c.negative.f}
                      </td>
                      <td class="py-3.5 px-4 text-emerald-700 dark:text-emerald-300 font-mono">
                        <span class="font-bold">${c.definite.n}</span> / ${c.indefinite.n} / ${c.negative.n}
                      </td>
                      <td class="py-3.5 px-4 text-amber-700 dark:text-amber-300 font-mono">
                        <span class="font-bold">${c.definite.pl}</span> / ${c.indefinite.pl} / ${c.negative.pl}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Personal Pronouns Transformation Chart -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Pronoun Declension (Personalpronomen)</h3>
            <p class="text-xs text-slate-500">Comparison of pronouns from Nominativ (I) to Akkusativ (me) to Dativ (to me).</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${[
              { nom: 'ich', akk: 'mich', dat: 'mir', gen: 'meiner', en: 'I / me / to me' },
              { nom: 'du', akk: 'dich', dat: 'dir', gen: 'deiner', en: 'you / you / to you' },
              { nom: 'er', akk: 'ihn', dat: 'ihm', gen: 'seiner', en: 'he / him / to him' },
              { nom: 'sie', akk: 'sie', dat: 'ihr', gen: 'ihrer', en: 'she / her / to her' },
              { nom: 'es', akk: 'es', dat: 'ihm', gen: 'seiner', en: 'it / it / to it' },
              { nom: 'man', akk: 'einen', dat: 'einem', gen: 'eines', en: 'one / one / to one' },
              { nom: 'wir', akk: 'uns', dat: 'uns', gen: 'unserer', en: 'we / us / to us' },
              { nom: 'ihr', akk: 'euch', dat: 'euch', gen: 'eurer', en: 'you guys / you guys' },
              { nom: 'sie / Sie', akk: 'sie / Sie', dat: 'ihnen / Ihnen', gen: 'ihrer / Ihrer', en: 'they / them / to them' }
            ].map(p => `
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <div class="text-xs text-slate-400">${p.en}</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    ${p.nom} <span class="text-slate-300 dark:text-slate-600">→</span> <span class="text-emerald-600 dark:text-emerald-400">${p.akk}</span> <span class="text-slate-300 dark:text-slate-600">→</span> <span class="text-amber-600 dark:text-amber-400">${p.dat}</span>
                  </div>
                </div>
                <button onclick="app.speak('${p.nom}, ${p.akk}, ${p.dat}', this)" class="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                  <i data-lucide="volume-2" class="w-4 h-4"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  selectCase(c) {
    this.selectedCase = c;
    this.render();
  }

  // --- Subtab 2: Preposition Matrix ---
  renderPrepositionsStudio() {
    const preps = GRAMMAR_DATA.prepositions;

    return `
      <div class="space-y-6">
        
        <!-- Preposition Overview Header -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-2">
          <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">German Prepositions Mastery</h2>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Prepositions dictate the case of the noun that follows them. Master the fixed Akkusativ, fixed Dativ, and Two-Way (Wechselpräpositionen).
          </p>
        </div>

        <!-- Two-Way Prepositions Interactive Widget (Wechselpräpositionen) -->
        <div class="bg-gradient-to-br from-indigo-900 via-slate-900 to-brand-950 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Interactive Rule Visualizer
              </span>
              <h3 class="text-xl sm:text-2xl font-extrabold mt-2">Two-Way Prepositions (Wechselpräpositionen)</h3>
              <p class="text-sm text-slate-300 max-w-xl">
                The golden rule: <strong>Wohin? (Movement / Destination) $\rightarrow$ Akkusativ</strong> versus <strong>Wo? (Stationary Location) $\rightarrow$ Dativ</strong>.
              </p>
            </div>

            <!-- Mode Switcher -->
            <div class="flex items-center space-x-2 bg-white/10 p-1 rounded-2xl border border-white/10">
              <button 
                onclick="app.setPrepTwoWayMode('movement')" 
                class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${this.prepTwoWayMode === 'movement' 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                  : 'text-slate-300 hover:text-white'}"
              >
                🏃 Wohin? (Movement $\rightarrow$ Akkusativ)
              </button>

              <button 
                onclick="app.setPrepTwoWayMode('position')" 
                class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${this.prepTwoWayMode === 'position' 
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' 
                  : 'text-slate-300 hover:text-white'}"
              >
                📍 Wo? (Location $\rightarrow$ Dativ)
              </button>
            </div>
          </div>

          <!-- Interactive Examples Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${preps.wechsel.items.map(item => {
              const isMovement = this.prepTwoWayMode === 'movement';
              const sentence = isMovement ? item.akk : item.dat;
              const caseBadge = isMovement ? 'Akkusativ' : 'Dativ';
              const badgeColor = isMovement ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

              return `
                <div class="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-extrabold text-lg text-white font-mono">${item.prep}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeColor}">
                      ${caseBadge}
                    </span>
                  </div>
                  <div class="text-xs text-slate-400">${item.en}</div>
                  <div class="text-sm font-medium text-slate-100 pt-1 flex items-center justify-between">
                    <span>${sentence}</span>
                    <button onclick="app.speak('${sentence.replace(/'/g, "\\'")}', this)" class="text-slate-400 hover:text-white p-1">
                      <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3 Fixed Preposition Columns: Akkusativ, Dativ, Genitiv -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Akkusativ Only -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 class="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">Akkusativ Only</h4>
                <p class="text-xs text-slate-500">Mnemonic: DOGFU / FUDGE-B</p>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold font-mono">
                durch, für, gegen...
              </span>
            </div>

            <div class="space-y-3">
              ${preps.akkusativ.items.map(p => `
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div class="font-bold text-slate-900 dark:text-white font-mono text-sm">${p.prep} <span class="text-xs text-slate-400 font-sans font-normal">(${p.en})</span></div>
                    <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">${p.ex}</div>
                  </div>
                  <button onclick="app.speak('${p.ex.replace(/'/g, "\\'")}', this)" class="p-1.5 text-slate-400 hover:text-emerald-600 transition">
                    <i data-lucide="volume-2" class="w-4 h-4"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Dativ Only -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 class="font-extrabold text-amber-600 dark:text-amber-400 text-base">Dativ Only</h4>
                <p class="text-xs text-slate-500">aus, bei, mit, nach, seit, von, zu...</p>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold font-mono">
                + Dativ
              </span>
            </div>

            <div class="space-y-3">
              ${preps.dativ.items.map(p => `
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div class="font-bold text-slate-900 dark:text-white font-mono text-sm">${p.prep} <span class="text-xs text-slate-400 font-sans font-normal">(${p.en})</span></div>
                    <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">${p.ex}</div>
                  </div>
                  <button onclick="app.speak('${p.ex.replace(/'/g, "\\'")}', this)" class="p-1.5 text-slate-400 hover:text-amber-600 transition">
                    <i data-lucide="volume-2" class="w-4 h-4"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Genitiv & Da/Wo Compounds -->
          <div class="space-y-6">
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 class="font-extrabold text-purple-600 dark:text-purple-400 text-base">Genitiv Prepositions</h4>
                  <p class="text-xs text-slate-500">während, wegen, trotz, statt</p>
                </div>
                <span class="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs font-bold font-mono">
                  + Genitiv
                </span>
              </div>

              <div class="space-y-3">
                ${preps.genitiv.items.map(p => `
                  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div class="font-bold text-slate-900 dark:text-white font-mono text-sm">${p.prep} <span class="text-xs text-slate-400 font-sans font-normal">(${p.en})</span></div>
                      <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">${p.ex}</div>
                    </div>
                    <button onclick="app.speak('${p.ex.replace(/'/g, "\\'")}', this)" class="p-1.5 text-slate-400 hover:text-purple-600 transition">
                      <i data-lucide="volume-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Da- & Wo- Compounds -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 class="font-extrabold text-slate-900 dark:text-white text-sm">Pronominal Adverbs (Wo- &amp; Da-)</h4>
              <p class="text-xs text-slate-500">Instead of "mit was?", German uses "womit?". Instead of "auf das", use "darauf".</p>
              <div class="grid grid-cols-2 gap-2 text-xs font-mono">
                ${preps.pronominal_adverbs.examples.map(ex => `
                  <div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <span class="text-brand-600 dark:text-brand-400 font-bold">${ex.question}</span> $\rightarrow$ <span class="text-slate-800 dark:text-slate-200 font-bold">${ex.answer}</span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;
  }

  setPrepTwoWayMode(mode) {
    this.prepTwoWayMode = mode;
    this.render();
  }

  // --- Subtab 3: Modals Studio ---
  renderModalsStudio() {
    const modals = GRAMMAR_DATA.modal_verbs;

    return `
      <div class="space-y-6">
        
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-2">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold uppercase">
              Attitude &amp; Modality
            </span>
          </div>
          <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">${modals.title}</h2>
          <p class="text-sm text-slate-600 dark:text-slate-300">${modals.rule}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${modals.verbs.map(v => `
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
              
              <div class="space-y-3">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 class="text-xl font-extrabold text-brand-600 dark:text-brand-400 font-mono">${v.verb}</h3>
                  <button onclick="app.speak('${v.verb}', this)" class="p-1.5 text-slate-400 hover:text-brand-600">
                    <i data-lucide="volume-2" class="w-4 h-4"></i>
                  </button>
                </div>

                <div class="text-xs font-medium text-slate-600 dark:text-slate-300">
                  ${v.meaning}
                </div>

                <!-- Conjugation Matrix -->
                <div class="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                  <div class="grid grid-cols-3 font-bold text-slate-400 uppercase text-[10px] pb-1 border-b border-slate-200 dark:border-slate-700">
                    <span>Person</span>
                    <span>Präsens</span>
                    <span>Präteritum</span>
                  </div>
                  ${['ich', 'du', 'er_sie_es', 'wir', 'ihr', 'sie_Sie'].map(p => {
                    const label = p.replace('_', '/');
                    return `
                      <div class="grid grid-cols-3 font-mono">
                        <span class="text-slate-500 font-sans">${label}</span>
                        <span class="font-bold text-brand-700 dark:text-brand-300">${v.praesens[p]}</span>
                        <span class="text-slate-600 dark:text-slate-400">${v.praeteritum[p]}</span>
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Authentic examples -->
                <div class="space-y-1.5 pt-2">
                  <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Examples:</div>
                  ${v.examples.map(ex => `
                    <div class="text-xs text-slate-700 dark:text-slate-300 flex items-start justify-between">
                      <span>• ${ex}</span>
                      <button onclick="app.speak('${ex.replace(/'/g, "\\'")}', this)" class="text-slate-400 hover:text-brand-500 p-0.5 shrink-0 ml-1">
                        <i data-lucide="volume-2" class="w-3 h-3"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>

              </div>

            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  // --- Subtab 4: Vowel Shifts & Prefixes ---
  renderShiftsAndPrefixesStudio() {
    const shifts = GRAMMAR_DATA.vowel_shifts;
    const sep = GRAMMAR_DATA.separable_verbs;

    return `
      <div class="space-y-6">
        
        <!-- Vowel Shifts Section -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">${shifts.title}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">Irregular present tense verbs that shift their stem vowel ONLY in the 2nd and 3rd person singular (du &amp; er/sie/es/man).</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${shifts.shifts.map(s => `
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span class="text-base font-extrabold text-brand-600 dark:text-brand-400 font-mono">${s.change}</span>
                  <span class="text-xs text-slate-400">${s.sound}</span>
                </div>
                <ul class="text-xs space-y-1.5 font-medium text-slate-700 dark:text-slate-300">
                  ${s.verbs.map(v => `
                    <li class="flex items-center justify-between group">
                      <span>${v}</span>
                      <button onclick="app.speak('${v.split(' ')[0]}', this)" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-500 transition">
                        <i data-lucide="volume-2" class="w-3 h-3"></i>
                      </button>
                    </li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Separable & Inseparable Prefixes -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Inseparable Prefixes -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-0.5 rounded text-xs font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Always Inseparable</span>
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1">Untrennbare Verben (Never separate!)</h3>
              <p class="text-xs text-slate-500">No 'ge-' in Partizip II, prefix never moves to the end. Mnemonic: <em>be-, emp-, ent-, er-, ge-, miss-, ver-, zer-, hinter-</em></p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              ${sep.inseparable_prefixes.map(p => `
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span class="font-extrabold text-red-600 dark:text-red-400 font-mono">${p.prefix}</span>
                    <div class="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">${p.ex}</div>
                  </div>
                  <button onclick="app.speak('${p.ex.replace(/'/g, "\\'")}', this)" class="p-1 text-slate-400 hover:text-red-600">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Variable Prefixes & Dual Meanings -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-0.5 rounded text-xs font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Dual Meaning Prefixes</span>
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1">Stress determines the meaning!</h3>
              <p class="text-xs text-slate-500">Stressed on prefix $\rightarrow$ Separable. Stressed on root $\rightarrow$ Inseparable.</p>
            </div>

            <div class="space-y-2 text-xs">
              ${sep.variable_prefixes.map(p => `
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                  <div class="font-bold text-slate-900 dark:text-white font-mono text-sm">${p.prefix}</div>
                  <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div class="text-emerald-700 dark:text-emerald-300">
                      <strong>Separable:</strong> ${p.sep}
                    </div>
                    <div class="text-purple-700 dark:text-purple-300">
                      <strong>Inseparable:</strong> ${p.insep}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="p-3 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-xs text-brand-800 dark:text-brand-200">
              💡 <strong>Hanan's Classic Joke:</strong> <em>"Ich muss das Kind umfahren"</em> — If separable (<em>Ich fahre das Kind um</em>), it means you run the child over! If inseparable (<em>Ich umfahre das Kind</em>), it means you steer around to avoid it!
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // --- Subtab 5: Word Order & Syntax ---
  renderSyntaxStudio() {
    const syntax = GRAMMAR_DATA.word_order;

    return `
      <div class="space-y-6">
        
        <!-- V2 Interactive Slider / Explainer -->
        <div class="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-6">
          <div>
            <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
              The Golden Rule of German Syntax
            </span>
            <h2 class="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">Verbzweitstellung (The V2 Rule)</h2>
            <p class="text-sm text-slate-300 max-w-2xl mt-1">
              In any German main clause (Hauptsatz), the <strong>CONJUGATED VERB is strictly locked at Position 2</strong>, no matter what you put in Position 1!
            </p>
          </div>

          <!-- Interactive Switcher -->
          <div class="space-y-3">
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Choose what comes in Position 1:</div>
            <div class="flex flex-wrap gap-2">
              <button 
                onclick="app.setV2Position1('Time')" 
                class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${this.v2Position1 === 'Time' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-white/10 text-slate-300 hover:bg-white/20'}"
              >
                ⏰ Start with Time (Adverbial)
              </button>
              <button 
                onclick="app.setV2Position1('Subject')" 
                class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${this.v2Position1 === 'Subject' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-white/10 text-slate-300 hover:bg-white/20'}"
              >
                👤 Start with Subject
              </button>
              <button 
                onclick="app.setV2Position1('Object')" 
                class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${this.v2Position1 === 'Object' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-white/10 text-slate-300 hover:bg-white/20'}"
              >
                🎯 Start with Object
              </button>
            </div>
          </div>

          <!-- Visual Sentence Blocks -->
          <div class="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
              
              <div class="p-3.5 rounded-xl bg-white/10 border border-white/20">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Position 1</span>
                <span class="text-lg font-extrabold text-white mt-1 block">
                  ${this.v2Position1 === 'Time' ? 'Letzten Mai' : (this.v2Position1 === 'Subject' ? 'Ich' : 'Die Grippe')}
                </span>
                <span class="text-[10px] text-slate-400 font-mono mt-0.5 block">${this.v2Position1}</span>
              </div>

              <div class="p-3.5 rounded-xl bg-brand-500 text-white shadow-md shadow-brand-500/30 border border-brand-400">
                <span class="text-[10px] uppercase font-bold text-brand-200 block">Position 2 (Locked!)</span>
                <span class="text-lg font-black text-white mt-1 block">hatte</span>
                <span class="text-[10px] text-brand-200 font-mono mt-0.5 block">Conjugated Verb</span>
              </div>

              <div class="p-3.5 rounded-xl bg-white/10 border border-white/20">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Position 3</span>
                <span class="text-lg font-extrabold text-white mt-1 block">
                  ${this.v2Position1 === 'Time' ? 'ich' : (this.v2Position1 === 'Subject' ? 'letzten Mai' : 'ich')}
                </span>
                <span class="text-[10px] text-slate-400 font-mono mt-0.5 block">Middle Field</span>
              </div>

              <div class="p-3.5 rounded-xl bg-white/10 border border-white/20">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Remainder</span>
                <span class="text-lg font-extrabold text-white mt-1 block">
                  ${this.v2Position1 === 'Time' ? 'die Grippe.' : (this.v2Position1 === 'Subject' ? 'die Grippe.' : 'letzten Mai.')}
                </span>
                <span class="text-[10px] text-slate-400 font-mono mt-0.5 block">End Field</span>
              </div>

            </div>

            <div class="text-center pt-2">
              <button onclick="app.speak('${this.v2Position1 === 'Time' ? 'Letzten Mai hatte ich die Grippe' : (this.v2Position1 === 'Subject' ? 'Ich hatte letzten Mai die Grippe' : 'Die Grippe hatte ich letzten Mai')}', this)" class="inline-flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
                <i data-lucide="volume-2" class="w-4 h-4"></i>
                <span>Listen to Sentence</span>
              </button>
            </div>
          </div>

        </div>

        <!-- TeKaMoLo & Subordinate Clauses (Nebensätze) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- TeKaMoLo Card -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <span class="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold uppercase">Middle Field Rule</span>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1">TeKaMoLo Order</h3>
              <p class="text-xs text-slate-500">When multiple adverbial phrases are placed in a sentence, arrange them in this order:</p>
            </div>

            <div class="space-y-2 text-xs">
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <div><span class="font-extrabold text-brand-600">Te</span>mporal (When?)</div>
                <div class="text-slate-500 font-mono">heute, um 8 Uhr, morgen</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <div><span class="font-extrabold text-brand-600">Ka</span>usal (Why?)</div>
                <div class="text-slate-500 font-mono">wegen des Regens, aus Liebe</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <div><span class="font-extrabold text-brand-600">Mo</span>dal (How?)</div>
                <div class="text-slate-500 font-mono">mit dem Zug, gern, schnell</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <div><span class="font-extrabold text-brand-600">Lo</span>kal (Where?)</div>
                <div class="text-slate-500 font-mono">nach Zürich, im Büro, zu Hause</div>
              </div>
            </div>
          </div>

          <!-- Nebensätze Card -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <span class="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold uppercase">Subordinate Clauses</span>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1">Nebensätze: Verb to the End!</h3>
              <p class="text-xs text-slate-500">Conjunctions like <em>weil, dass, obwohl, wenn, als</em> push the conjugated verb to the absolute end of the clause.</p>
            </div>

            <div class="space-y-3 text-xs">
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 space-y-1">
                <div class="font-bold text-slate-900 dark:text-white">With "weil" (because):</div>
                <div class="text-slate-600 dark:text-slate-300">
                  Ich esse keine Nüsse, <span class="text-emerald-600 dark:text-emerald-400 font-bold">weil</span> ich allergisch gegen Nüsse <span class="text-red-600 dark:text-red-400 font-extrabold underline">bin</span>.
                </div>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 space-y-1">
                <div class="font-bold text-slate-900 dark:text-white">With "als" (when in past):</div>
                <div class="text-slate-600 dark:text-slate-300">
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold">Als</span> wir in Paris gelebt <span class="text-red-600 dark:text-red-400 font-extrabold underline">haben</span>, <span class="text-brand-600 font-extrabold">war</span> Bea schwanger.
                </div>
                <div class="text-[11px] text-slate-400">Notice: If the Nebensatz comes first, the main clause starts with the verb (Position 2 rule)!</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  setV2Position1(pos) {
    this.v2Position1 = pos;
    this.render();
  }

  // --- Subtab 6: Perfekt (Past Tense) ---
  renderPerfektStudio() {
    const p = GRAMMAR_DATA.perfekt;

    return `
      <div class="space-y-6">
        
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
          <span class="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold uppercase">Conversational Past</span>
          <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">${p.title}</h2>
          <p class="text-sm text-slate-600 dark:text-slate-300 font-mono">${p.formula}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Sein vs Haben Decision Guide -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">When to use "SEIN"?</h3>
            <p class="text-xs text-slate-500">${p.sein_rule}</p>

            <div class="space-y-2 text-xs">
              <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">
                <strong>1. Movement / Change of Place:</strong> gehen, fahren, fliegen, schwimmen, rennen, reisen...
                <div class="mt-1 font-mono text-slate-600 dark:text-slate-300">Ich bin nach Davos gefahren.</div>
              </div>

              <div class="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-200">
                <strong>2. Change of State:</strong> aufwachen, einschlafen, wachsen, sterben...
                <div class="mt-1 font-mono text-slate-600 dark:text-slate-300">Mein Sohn ist gewachsen.</div>
              </div>

              <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200">
                <strong>3. Key Exceptions:</strong> bleiben (ist geblieben), sein (ist gewesen), werden (ist geworden), passieren (ist passiert).
              </div>
            </div>
          </div>

          <!-- Participle Formation Groups -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Partizip II Formation Groups</h3>
            <p class="text-xs text-slate-500">How the past participle is built for regular, irregular, and -ieren verbs.</p>

            <div class="space-y-2.5 text-xs">
              ${p.participle_types.map(pt => `
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div class="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                    <span>${pt.type}</span>
                    <span class="font-mono text-brand-600 dark:text-brand-400">${pt.rule}</span>
                  </div>
                  <div class="text-slate-500">${pt.ex}</div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // --- Subtab 7: Time, Numbers & Directions ---
  renderTimeAndNumbersStudio() {
    const time = GRAMMAR_DATA.time_and_numbers.time;
    const nums = GRAMMAR_DATA.time_and_numbers.numbers;
    const dirs = GRAMMAR_DATA.directions.items;

    return `
      <div class="space-y-6">
        
        <!-- Location vs Direction Matrix -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Ort vs. Richtung (Location vs. Direction)</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">Colloquial short forms used every day in spoken German (rauf, runter, rein, raus, rüber).</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            ${dirs.map(d => `
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 space-y-2 text-center">
                <span class="text-xs font-bold text-slate-400 uppercase">${d.formal_prep}</span>
                <div class="text-sm font-bold text-slate-900 dark:text-white">${d.ort}</div>
                <div class="text-xs text-brand-600 dark:text-brand-400 font-extrabold bg-brand-50 dark:bg-brand-950/60 py-1 px-2 rounded-lg border border-brand-200 dark:border-brand-800">
                  $\rightarrow$ ${d.richtung}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Telling Time & Clock Expressions -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Colloquial vs. Formal Uhrzeiten</h3>
              <p class="text-xs text-slate-500">Notice that "halb sieben" means 6:30 (half-way TO seven)!</p>
            </div>

            <div class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              ${time.formal_vs_informal.map(t => `
                <div class="py-2.5 flex items-center justify-between">
                  <div class="font-mono text-slate-400">${t.clock}</div>
                  <div class="font-bold text-slate-900 dark:text-white font-sans text-sm">${t.informal}</div>
                  <div class="text-slate-500 font-mono">${t.formal}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Numbers Reference -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Zahlen &amp; Zählen (Numbers)</h3>
              <p class="text-xs text-slate-500">German counts units before tens (einundzwanzig = one-and-twenty).</p>
            </div>

            <div class="space-y-3 text-xs">
              ${nums.map(n => `
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div class="font-bold text-brand-600 dark:text-brand-400 font-mono text-sm">${n.n}</div>
                  <div class="text-slate-700 dark:text-slate-300">${n.text}</div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // ==========================================
  // PILLAR 3: PRACTICE & QUIZ ARENA
  // ==========================================
  renderQuizTab() {
    return `
      <div class="space-y-6">
        
        <!-- Practice Arena Header & Mode Switcher -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Interactive Practice &amp; Quiz Arena</h2>
            <p class="text-xs sm:text-sm text-slate-500">Test and solidify your knowledge with flashcards and drills from your notes.</p>
          </div>

          <div class="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onclick="app.setQuizType('flashcard')" 
              class="px-4 py-2 rounded-lg text-xs font-bold transition ${this.quizType === 'flashcard' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}"
            >
              🃏 Flashcards
            </button>

            <button 
              onclick="app.setQuizType('modal')" 
              class="px-4 py-2 rounded-lg text-xs font-bold transition ${this.quizType === 'modal' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}"
            >
              ✍️ Modal Verb Drill
            </button>

            <button 
              onclick="app.setQuizType('gender')" 
              class="px-4 py-2 rounded-lg text-xs font-bold transition ${this.quizType === 'gender' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}"
            >
              🎯 Der / Die / Das
            </button>
          </div>
        </div>

        <!-- Render Current Practice Mode -->
        ${this.quizType === 'flashcard' ? this.renderFlashcardsMode() : (this.quizType === 'modal' ? this.renderModalDrillMode() : this.renderGenderGuesserMode())}

      </div>
    `;
  }

  setQuizType(type) {
    this.quizType = type;
    this.render();
  }

  // --- Flashcard Mode ---
  renderFlashcardsMode() {
    const card = this.flashcards[this.currentFlashcardIdx] || VOCAB_DATA[0];
    const isLearned = this.learnedIds.has(card.id);
    const isStarred = this.starredIds.has(card.id);

    return `
      <div class="max-w-xl mx-auto space-y-6">
        
        <!-- Controls & Deck Progress -->
        <div class="flex items-center justify-between text-xs text-slate-500 font-medium px-2">
          <div>
            Card <span class="font-bold text-slate-800 dark:text-slate-200">${this.currentFlashcardIdx + 1}</span> of <span class="font-bold text-slate-800 dark:text-slate-200">${this.flashcards.length}</span>
          </div>

          <div class="flex items-center space-x-2">
            <button onclick="app.shuffleFlashcards()" class="hover:text-brand-600 flex items-center space-x-1" title="Shuffle Deck">
              <i data-lucide="shuffle" class="w-3.5 h-3.5"></i>
              <span>Shuffle</span>
            </button>
            <span>•</span>
            <button onclick="app.filterFlashcardsStarred()" class="hover:text-amber-500 flex items-center space-x-1" title="Study Starred Cards">
              <i data-lucide="star" class="w-3.5 h-3.5"></i>
              <span>Starred only</span>
            </button>
          </div>
        </div>

        <!-- 3D Flashcard Element -->
        <div 
          onclick="app.flipFlashcard()" 
          class="relative w-full h-80 cursor-pointer perspective-1000 select-none group"
        >
          <div class="w-full h-full duration-500 transform-style-preserve-3d transition-transform ${this.isCardFlipped ? 'rotate-y-180' : ''}">
            
            <!-- Card Front (German) -->
            <div class="absolute inset-0 w-full h-full rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-8 flex flex-col justify-between items-center text-center shadow-lg backface-hidden group-hover:border-brand-300 dark:group-hover:border-brand-700 transition">
              
              <div class="w-full flex items-center justify-between text-xs text-slate-400">
                <span class="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold">${card.category}</span>
                <span class="text-xs">Click or press Space to flip ↺</span>
                <span class="text-xs">📅 ${card.date}</span>
              </div>

              <div class="space-y-3">
                ${card.article ? `
                  <span class="inline-block px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider ${card.article === 'der' ? 'badge-masculine' : (card.article === 'die' && card.gender !== 'plural' ? 'badge-feminine' : (card.article === 'das' ? 'badge-neuter' : 'badge-plural'))}">
                    ${card.article}
                  </span>
                ` : ''}
                <h3 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  ${card.german}
                </h3>
                ${card.plural ? `<p class="text-sm text-amber-600 dark:text-amber-400">Plural: ${card.plural}</p>` : ''}
              </div>

              <div class="flex items-center space-x-2">
                <button 
                  onclick="event.stopPropagation(); app.speak('${card.german.replace(/'/g, "\\'")}', this)" 
                  class="p-3 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950 dark:hover:bg-brand-900 dark:text-brand-300 transition"
                  title="Listen"
                >
                  <i data-lucide="volume-2" class="w-5 h-5"></i>
                </button>
              </div>

            </div>

            <!-- Card Back (English & Examples) -->
            <div class="absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-tr from-brand-900 to-indigo-950 border-2 border-brand-800 p-8 flex flex-col justify-between items-center text-center shadow-lg backface-hidden rotate-y-180 text-white">
              
              <div class="w-full flex items-center justify-between text-xs text-blue-200">
                <span class="font-mono">${card.german}</span>
                <span>Click to flip back ↺</span>
              </div>

              <div class="space-y-3">
                <span class="text-xs uppercase font-bold text-brand-300 tracking-wider">English Meaning</span>
                <h3 class="text-2xl sm:text-3xl font-bold text-white">
                  ${card.english}
                </h3>
                ${card.examples && card.examples.length > 0 ? `
                  <div class="p-3 rounded-xl bg-white/10 text-xs text-blue-100 max-w-sm mx-auto">
                    "${card.examples[0].de}"
                  </div>
                ` : ''}
              </div>

              <div class="text-xs text-blue-300">
                Press Left/Right Arrow to navigate
              </div>

            </div>

          </div>
        </div>

        <!-- Flashcard Action Buttons -->
        <div class="flex items-center justify-between space-x-3">
          <button 
            onclick="app.prevFlashcard()" 
            class="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-medium text-sm flex items-center space-x-1"
          >
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            <span>Previous</span>
          </button>

          <button 
            onclick="app.flipFlashcard()" 
            class="flex-1 py-3 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-bold text-sm transition"
          >
            Flip Card (Space)
          </button>

          <button 
            onclick="app.nextFlashcard()" 
            class="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition font-bold text-sm flex items-center space-x-1 shadow-md shadow-brand-500/20"
          >
            <span>Next</span>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        </div>

      </div>
    `;
  }

  flipFlashcard() {
    this.isCardFlipped = !this.isCardFlipped;
    this.render();
  }

  nextFlashcard() {
    this.isCardFlipped = false;
    this.currentFlashcardIdx = (this.currentFlashcardIdx + 1) % this.flashcards.length;
    this.render();
  }

  prevFlashcard() {
    this.isCardFlipped = false;
    this.currentFlashcardIdx = (this.currentFlashcardIdx - 1 + this.flashcards.length) % this.flashcards.length;
    this.render();
  }

  shuffleFlashcards() {
    this.flashcards = [...this.flashcards].sort(() => Math.random() - 0.5);
    this.currentFlashcardIdx = 0;
    this.isCardFlipped = false;
    this.render();
  }

  filterFlashcardsStarred() {
    const starred = VOCAB_DATA.filter(v => this.starredIds.has(v.id));
    if (starred.length === 0) {
      alert("No starred words yet! Click the star icon on any vocabulary card to add it to your practice deck.");
      return;
    }
    this.flashcards = starred;
    this.currentFlashcardIdx = 0;
    this.isCardFlipped = false;
    this.render();
  }

  // --- Modal Drill Mode ---
  renderModalDrillMode() {
    const q = QUIZ_DATA[this.currentQuizIdx] || QUIZ_DATA[0];

    return `
      <div class="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        
        <div class="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
          <span>Question ${this.currentQuizIdx + 1} of ${QUIZ_DATA.length}</span>
          <div class="flex items-center space-x-2">
            <span>Score: <strong class="text-slate-800 dark:text-slate-200">${this.quizScore}</strong></span>
            <span>•</span>
            <span class="text-amber-500 font-bold">🔥 Streak: ${this.streak}</span>
          </div>
        </div>

        <div class="space-y-3">
          <span class="px-2.5 py-1 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 text-xs font-bold uppercase">
            Modal Verb Conjugation
          </span>
          <h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
            ${q.prompt}
          </h3>
        </div>

        <!-- Answer Input & Form -->
        <div class="space-y-4">
          <div class="flex items-center space-x-2">
            <input 
              type="text" 
              id="quiz-input" 
              placeholder="Type correct form (e.g. kann, muss, will, soll)..." 
              class="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500 outline-none"
              onkeydown="if(event.key==='Enter') app.submitQuizAnswer()"
              ${this.quizAnswered ? 'disabled' : ''}
              autofocus
            />
            ${!this.quizAnswered ? `
              <button 
                onclick="app.submitQuizAnswer()" 
                class="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/20 transition"
              >
                Check
              </button>
            ` : `
              <button 
                onclick="app.nextQuizQuestion()" 
                class="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition flex items-center space-x-1"
              >
                <span>Next</span>
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
              </button>
            `}
          </div>

          <!-- Answer Feedback -->
          ${this.quizAnswered ? `
            <div class="p-4 rounded-2xl ${this.isAnswerCorrect ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200 border border-red-200 dark:border-red-800'} space-y-1">
              <div class="flex items-center space-x-2 font-bold text-sm">
                <i data-lucide="${this.isAnswerCorrect ? 'check-circle' : 'x-circle'}" class="w-5 h-5"></i>
                <span>${this.isAnswerCorrect ? 'Richtig! (Correct!)' : 'Leider falsch (Incorrect)'}</span>
              </div>
              <div class="text-xs mt-1">
                Correct answer: <strong class="font-mono text-sm">${q.answer}</strong>
              </div>
              <div class="text-xs text-slate-600 dark:text-slate-300 pt-1">
                💡 ${q.explanation}
              </div>
            </div>
          ` : ''}

        </div>

      </div>
    `;
  }

  submitQuizAnswer() {
    if (this.quizAnswered) return;
    const input = document.getElementById('quiz-input');
    if (!input || !input.value.trim()) return;

    const userVal = input.value.trim().toLowerCase();
    const q = QUIZ_DATA[this.currentQuizIdx];
    const correctVal = q.answer.trim().toLowerCase();

    this.isAnswerCorrect = userVal === correctVal;
    this.quizAnswered = true;

    if (this.isAnswerCorrect) {
      this.quizScore += 1;
      this.streak += 1;
      this.speak(q.answer);
    } else {
      this.streak = 0;
    }

    this.render();
  }

  nextQuizQuestion() {
    this.quizAnswered = false;
    this.currentQuizIdx = (this.currentQuizIdx + 1) % QUIZ_DATA.length;
    this.render();
  }

  // --- Gender Guesser Mode ---
  renderGenderGuesserMode() {
    const noun = this.genderNouns[this.currentGenderIdx] || this.genderNouns[0];

    return `
      <div class="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 text-center space-y-6">
        
        <div class="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
          <span>Rapid-Fire Article Trainer</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">Score: ${this.genderScore} / ${this.genderTotal}</span>
        </div>

        <div class="space-y-2 py-4">
          <span class="text-xs text-slate-400 uppercase font-bold tracking-wider">What is the correct gender of:</span>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            ${noun.base_word || noun.german}
          </h2>
          <p class="text-sm text-slate-500 font-medium">"${noun.english}"</p>
        </div>

        <!-- 3 Big Buttons -->
        <div class="grid grid-cols-3 gap-3">
          <button 
            onclick="app.guessGender('der')" 
            class="py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xl shadow-lg shadow-blue-500/20 active:scale-95 transition"
          >
            der
          </button>

          <button 
            onclick="app.guessGender('die')" 
            class="py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-xl shadow-lg shadow-red-500/20 active:scale-95 transition"
          >
            die
          </button>

          <button 
            onclick="app.guessGender('das')" 
            class="py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition"
          >
            das
          </button>
        </div>

      </div>
    `;
  }

  guessGender(selected) {
    const noun = this.genderNouns[this.currentGenderIdx];
    const correct = noun.article;

    this.genderTotal += 1;
    if (selected === correct) {
      this.genderScore += 1;
      this.speak(`${noun.article} ${noun.base_word}`);
    }

    this.currentGenderIdx = Math.floor(Math.random() * this.genderNouns.length);
    this.render();
  }

  // ==========================================
  // PILLAR 4: JOURNAL & HOMEWORK STUDIO
  // ==========================================
  renderJournalTab() {
    const story = JOURNAL_DATA.find(j => j.id === this.activeJournalId) || JOURNAL_DATA[0];

    return `
      <div class="space-y-6">
        
        <!-- Header & Story Selector -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Journal &amp; Homework Studio</h2>
            <p class="text-xs sm:text-sm text-slate-500">Review real trip stories from your notes, spot the corrections, and write your own texts with live umlaut assistance.</p>
          </div>

          <div class="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onclick="app.setActiveJournal('davos')" 
              class="px-4 py-2 rounded-lg text-xs font-bold transition ${this.activeJournalId === 'davos' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}"
            >
              🏔️ Davos Trip
            </button>

            <button 
              onclick="app.setActiveJournal('suedtirol')" 
              class="px-4 py-2 rounded-lg text-xs font-bold transition ${this.activeJournalId === 'suedtirol' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}"
            >
              ☀️ Südtirol Trip
            </button>

            <button 
              onclick="app.setActiveJournal('scratchpad')" 
              class="px-4 py-2 rounded-lg text-xs font-bold transition ${this.activeJournalId === 'scratchpad' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}"
            >
              ✍️ My Scratchpad
            </button>
          </div>
        </div>

        ${this.activeJournalId === 'scratchpad' ? this.renderScratchpad() : this.renderStoryComparison(story)}

      </div>
    `;
  }

  setActiveJournal(id) {
    this.activeJournalId = id;
    this.render();
  }

  renderStoryComparison(story) {
    return `
      <div class="space-y-6">
        
        <!-- Side by Side Comparison Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Original Student Draft -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center space-x-1">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                <span>Original Journal Entry</span>
              </span>
              <span class="text-xs text-slate-400">As written in class</span>
            </div>

            <div class="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 whitespace-pre-line text-sm leading-relaxed font-sans">
              ${story.original_text}
            </div>
          </div>

          <!-- Tutor Corrected Version -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center space-x-1">
                <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                <span>Hanan's Corrected German</span>
              </span>
              <button onclick="app.speak('${story.corrected_text.replace(/'/g, "\\'").replace(/\n/g, ' ')}', this)" class="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1">
                <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
                <span>Listen All</span>
              </button>
            </div>

            <div class="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 text-slate-900 dark:text-slate-100 whitespace-pre-line text-sm leading-relaxed font-medium">
              ${story.corrected_text}
            </div>
          </div>

        </div>

        <!-- Point-by-Point Grammar Breakdown -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div class="flex items-center space-x-2">
            <i data-lucide="sparkles" class="w-5 h-5 text-indigo-500"></i>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Tutor Corrections &amp; Grammatical Insights</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${story.corrections.map(c => `
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <div class="flex items-center space-x-2 text-xs">
                  <span class="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-mono line-through">${c.original}</span>
                  <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold">${c.corrected}</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300">${c.reason}</p>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  // --- Scratchpad ---
  renderScratchpad() {
    return `
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">German Writing Practice Pad</h3>
          <p class="text-xs text-slate-500">Practice writing sentences, journal entries, or homework. Use quick-insert buttons for German umlauts.</p>
        </div>

        <!-- Umlauts Quick Toolbar -->
        <div class="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
          <span class="font-bold text-slate-400 px-2 uppercase text-[10px]">Insert Umlaut:</span>
          ${['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map(u => `
            <button onclick="app.insertUmlaut('${u}')" class="px-3 py-1 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 hover:bg-brand-500 hover:text-white transition shadow-sm">
              ${u}
            </button>
          `).join('')}
        </div>

        <textarea 
          id="scratchpad-textarea"
          rows="8"
          placeholder="Schreib etwas auf Deutsch... (Write something in German...)"
          class="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none transition"
        ></textarea>

        <div class="flex items-center justify-between">
          <button onclick="app.speakScratchpad()" class="px-4 py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-semibold text-xs transition flex items-center space-x-1.5">
            <i data-lucide="volume-2" class="w-4 h-4"></i>
            <span>Read Aloud</span>
          </button>

          <button onclick="app.clearScratchpad()" class="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-xs transition">
            Clear
          </button>
        </div>
      </div>
    `;
  }

  insertUmlaut(u) {
    const area = document.getElementById('scratchpad-textarea');
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    area.value = area.value.substring(0, start) + u + area.value.substring(end);
    area.selectionStart = area.selectionEnd = start + 1;
    area.focus();
  }

  speakScratchpad() {
    const area = document.getElementById('scratchpad-textarea');
    if (!area || !area.value.trim()) return;
    this.speak(area.value);
  }

  clearScratchpad() {
    const area = document.getElementById('scratchpad-textarea');
    if (area) area.value = '';
  }

}

  // Initialize Application and attach globally
  function initApp() {
    const app = new DeutschPortalApp();
    if (typeof window !== 'undefined') window.app = app;
    if (typeof module !== 'undefined' && module.exports) module.exports = { app };
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  } else {
    initApp();
  }
})();
