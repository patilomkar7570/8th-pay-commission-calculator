// 8th Pay Commission Fitment & Salary Calculator Engine
// All allowances in the 8th Pay Commission are computed directly from the REVISED 8th Basic Pay.

let currentTabIndex = 0;
let customItems = [
  {
    id: 'item_cea',
    name: 'Children Education Allowance (CEA)',
    type: 'plus', // plus (allowance) or minus (deduction)
    mode: 'num',  // 'num' or 'pct'
    value: 2250
  }
];

// Calculation state object to easily feed the PDF and Print generator
let lastCalcState = {};

// Currency Formatter
function formatINR(number) {
  if (isNaN(number) || number === null) return '₹0';
  const rounded = Math.round(number);
  return '₹' + rounded.toLocaleString('en-IN');
}

// Compute component value based on mode ('num' or 'pct')
function getCalculatedValue(val, mode, baseAmount) {
  const num = parseFloat(val) || 0;
  if (mode === 'pct') {
    return (baseAmount * num) / 100;
  }
  return num;
}

// Tab List Helper
function getAllTabIds() {
  const regularTabs = ['tab-basic', 'tab-fitment', 'tab-da', 'tab-hra', 'tab-deductions'];
  const customTabIds = customItems.map(item => `tab-${item.id}`);
  return [...regularTabs, ...customTabIds];
}

// Update Active Tab View
function showTab(index) {
  const allTabs = getAllTabIds();
  if (index < 0 || index >= allTabs.length) return;
  currentTabIndex = index;

  const targetTabId = allTabs[index];

  // Update tabs header buttons
  document.querySelectorAll('.tabs-nav .tab-btn:not(.add-tab-btn)').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === targetTabId;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // Update tab panels
  document.querySelectorAll('.tabs-content .tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === targetTabId);
  });

  // Update Bottom Nav
  const prevBtn = document.getElementById('prevTabBtn');
  const nextBtn = document.getElementById('nextTabBtn');
  const stepIndicator = document.getElementById('tabStepIndicator');

  if (prevBtn) prevBtn.disabled = currentTabIndex === 0;
  if (nextBtn) nextBtn.disabled = currentTabIndex === allTabs.length - 1;
  if (stepIndicator) stepIndicator.textContent = `Tab ${currentTabIndex + 1} of ${allTabs.length}`;

  const activeBtn = document.querySelector(`.tabs-nav .tab-btn[data-tab="${targetTabId}"]`);
  if (activeBtn) {
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// Mode Toggle logic (Numbers vs Percentage buttons above each component)
function initModeToggles() {
  const toggleButtons = document.querySelectorAll('.mode-btn[data-target]');

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetHiddenInputId = btn.getAttribute('data-target');
      const selectedValue = btn.getAttribute('data-val');
      const hiddenInput = document.getElementById(targetHiddenInputId);

      if (!hiddenInput) return;

      const siblingButtons = btn.parentElement.querySelectorAll('.mode-btn');
      siblingButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      hiddenInput.value = selectedValue;

      updatePrefixSuffix(targetHiddenInputId, selectedValue);
      calculateSalary();
    });
  });
}

function updatePrefixSuffix(targetId, mode) {
  const prefixMap = {
    fitmentMode: { num: '×', pct: '%' },
    currDaMode: { num: '₹', pct: '%' },
    revDaMode: { num: '₹', pct: '%' },
    hraMode: { num: '₹', pct: '%' },
    taMode: { num: '₹', pct: '%' },
    npsMode: { num: '₹', pct: '%' },
    cghsMode: { num: '₹', pct: '%' },
    miscDedMode: { num: '₹', pct: '%' }
  };

  const suffixMap = {
    fitmentMode: { num: 'Multiplier Ratio', pct: '% Hike on Basic' },
    currDaMode: { num: 'Rupees', pct: '% of Old Basic' },
    revDaMode: { num: 'Rupees', pct: '% of New Basic' },
    hraMode: { num: 'Rupees', pct: '% of New Basic' },
    taMode: { num: 'Rupees', pct: '% of New Basic' },
    npsMode: { num: 'Rupees', pct: '% of New Basic+DA' },
    cghsMode: { num: 'Rupees', pct: '% of New Basic' },
    miscDedMode: { num: 'Rupees', pct: '% of New Basic' }
  };

  const baseName = targetId.replace('Mode', '');
  const prefixElem = document.getElementById(`${baseName}Prefix`);
  const suffixElem = document.getElementById(`${baseName}Suffix`);

  if (prefixElem && prefixMap[targetId]) {
    prefixElem.textContent = prefixMap[targetId][mode];
  }
  if (suffixElem && suffixMap[targetId]) {
    suffixElem.textContent = suffixMap[targetId][mode];
  }
}

// Preset Quick Setters
window.setBasicPay = function(amount) {
  document.getElementById('basicPayInput').value = amount;
  calculateSalary();
};

window.setFitment = function(val, mode) {
  const hiddenInput = document.getElementById('fitmentMode');
  hiddenInput.value = mode;

  const buttons = hiddenInput.parentElement.querySelectorAll('.mode-btn');
  buttons.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-val') === mode);
  });

  document.getElementById('fitmentValue').value = val;
  updatePrefixSuffix('fitmentMode', mode);
  calculateSalary();
};

window.setFieldValue = function(baseName, val, mode) {
  const hiddenInput = document.getElementById(`${baseName}Mode`);
  if (hiddenInput) {
    hiddenInput.value = mode;
    const buttons = hiddenInput.parentElement.querySelectorAll('.mode-btn');
    buttons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-val') === mode);
    });
    updatePrefixSuffix(`${baseName}Mode`, mode);
  }
  const inputElem = document.getElementById(`${baseName}Value`);
  if (inputElem) {
    inputElem.value = val;
  }
  calculateSalary();
};

// Render Dynamic Custom Item Tabs and Panels
function renderCustomTabs() {
  const nav = document.getElementById('tabsNav');
  const content = document.getElementById('tabsContent');
  const openModalBtn = document.getElementById('openAddModalBtn');

  // Remove existing dynamic tabs and panels
  document.querySelectorAll('.dynamic-tab-btn').forEach(b => b.remove());
  document.querySelectorAll('.dynamic-tab-panel').forEach(p => p.remove());

  customItems.forEach(item => {
    // 1. Tab Button
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab-btn dynamic-tab-btn';
    tabBtn.setAttribute('data-tab', `tab-${item.id}`);
    tabBtn.setAttribute('role', 'tab');
    tabBtn.innerHTML = `
      <span class="tab-icon">${item.type === 'plus' ? '➕' : '➖'}</span>
      <span class="tab-label">${escapeHtml(item.name)}</span>
    `;
    tabBtn.addEventListener('click', () => {
      const allTabs = getAllTabIds();
      const idx = allTabs.indexOf(`tab-${item.id}`);
      showTab(idx);
    });
    nav.insertBefore(tabBtn, openModalBtn);

    // 2. Tab Panel
    const panel = document.createElement('div');
    panel.className = 'tab-panel dynamic-tab-panel';
    panel.id = `tab-${item.id}`;
    panel.setAttribute('role', 'tabpanel');

    const isPlus = item.type === 'plus';
    const typeTitle = isPlus ? 'Allowance / Extra Pay (Plus)' : 'Salary Deduction (Minus)';
    const typeDesc = isPlus 
      ? 'This amount will be added to your 8th CPC Gross Salary, computed from the new Basic Pay.' 
      : 'This amount will be deducted from your Salary, computed from the new Basic Pay.';

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="panel-desc">${typeTitle} &bull; ${typeDesc}</p>
        </div>
      </div>

      <div class="component-card">
        <div class="component-top">
          <div>
            <span class="comp-title">Calculation Mode</span>
            <span class="comp-sub">Select whether to calculate as % of <strong>New 8th Basic</strong> or fixed Rupees</span>
          </div>
          <div class="toggle-switch-group">
            <button type="button" class="mode-btn ${item.mode === 'num' ? 'active' : ''}" onclick="updateCustomItemMode('${item.id}', 'num')">₹ In Numbers</button>
            <button type="button" class="mode-btn ${item.mode === 'pct' ? 'active' : ''}" onclick="updateCustomItemMode('${item.id}', 'pct')">% of New Basic</button>
          </div>
        </div>

        <div class="input-wrapper">
          <span class="input-prefix">${item.mode === 'pct' ? '%' : '₹'}</span>
          <input type="number" value="${item.value}" step="${item.mode === 'pct' ? '0.5' : '50'}" min="0" class="styled-input" id="input_${item.id}">
          <span class="input-suffix">${item.mode === 'pct' ? '% of New Basic' : 'Rupees'}</span>
        </div>

        <div class="custom-panel-actions">
          <button type="button" class="delete-item-btn" onclick="deleteCustomItem('${item.id}')">
            🗑️ Remove Component
          </button>
        </div>
      </div>
    `;

    content.appendChild(panel);

    const numInput = panel.querySelector(`#input_${item.id}`);
    numInput.addEventListener('input', (e) => {
      item.value = parseFloat(e.target.value) || 0;
      calculateSalary();
    });
  });

  const allTabs = getAllTabIds();
  if (currentTabIndex >= allTabs.length) {
    currentTabIndex = allTabs.length - 1;
  }
  showTab(currentTabIndex);
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

window.updateCustomItemMode = function(id, mode) {
  const item = customItems.find(i => i.id === id);
  if (!item) return;
  item.mode = mode;
  renderCustomTabs();
  calculateSalary();
};

window.deleteCustomItem = function(id) {
  const index = customItems.findIndex(i => i.id === id);
  if (index !== -1) {
    customItems.splice(index, 1);
    renderCustomTabs();
    calculateSalary();
  }
};

// Core Calculation Engine
function calculateSalary() {
  const currBasic = parseFloat(document.getElementById('basicPayInput').value) || 0;

  // Fitment Factor Calculation to get REVISED 8th Basic
  const fitmentMode = document.getElementById('fitmentMode').value;
  const fitmentVal = parseFloat(document.getElementById('fitmentValue').value) || 0;
  
  let revisedBasic = 0;
  if (fitmentMode === 'num') {
    revisedBasic = currBasic * fitmentVal;
  } else {
    revisedBasic = currBasic + (currBasic * fitmentVal) / 100;
  }

  const livePreview = document.getElementById('liveRevisedBasicPreview');
  if (livePreview) {
    livePreview.textContent = formatINR(revisedBasic);
  }

  // 1. Dearness Allowance (DA)
  const currDaMode = document.getElementById('currDaMode').value;
  const currDaVal = parseFloat(document.getElementById('currDaValue').value) || 0;
  const currDaAmt = getCalculatedValue(currDaVal, currDaMode, currBasic);

  // Revised 8th CPC DA (FROM NEW 8th BASIC)
  const revDaMode = document.getElementById('revDaMode').value;
  const revDaVal = parseFloat(document.getElementById('revDaValue').value) || 0;
  const revDaAmt = getCalculatedValue(revDaVal, revDaMode, revisedBasic);

  // 2. House Rent Allowance (HRA)
  const hraMode = document.getElementById('hraMode').value;
  const hraVal = parseFloat(document.getElementById('hraValue').value) || 0;
  const currHraAmt = getCalculatedValue(hraVal, hraMode, currBasic);
  const revHraAmt = getCalculatedValue(hraVal, hraMode, revisedBasic);

  // 3. Transport Allowance (TA)
  const taMode = document.getElementById('taMode').value;
  const taVal = parseFloat(document.getElementById('taValue').value) || 0;
  const currTaAmt = getCalculatedValue(taVal, taMode, currBasic);
  const revTaAmt = getCalculatedValue(taVal, taMode, revisedBasic);

  // 4. Custom Dynamic Components
  let customAllowancesTotal = 0;
  let customDeductionsTotal = 0;
  let currCustomAllowancesTotal = 0;
  let currCustomDeductionsTotal = 0;
  const dynamicRowsData = [];

  customItems.forEach(item => {
    const itemAmount = getCalculatedValue(item.value, item.mode, revisedBasic);
    const oldItemAmount = getCalculatedValue(item.value, item.mode, currBasic);

    if (item.type === 'plus') {
      customAllowancesTotal += itemAmount;
      currCustomAllowancesTotal += oldItemAmount;
      dynamicRowsData.push({
        name: item.name,
        type: 'plus',
        currVal: oldItemAmount,
        revVal: itemAmount
      });
    } else {
      customDeductionsTotal += itemAmount;
      currCustomDeductionsTotal += oldItemAmount;
      dynamicRowsData.push({
        name: item.name,
        type: 'minus',
        currVal: oldItemAmount,
        revVal: itemAmount
      });
    }
  });

  // Gross Salaries
  const currGross = currBasic + currDaAmt + currHraAmt + currTaAmt + currCustomAllowancesTotal;
  const revGross = revisedBasic + revDaAmt + revHraAmt + revTaAmt + customAllowancesTotal;

  // Deductions: NPS (standard 10% of Basic + DA)
  const npsMode = document.getElementById('npsMode').value;
  const npsVal = parseFloat(document.getElementById('npsValue').value) || 0;
  const currNpsAmt = getCalculatedValue(npsVal, npsMode, currBasic + currDaAmt);
  const revNpsAmt = getCalculatedValue(npsVal, npsMode, revisedBasic + revDaAmt);

  // CGHS / Insurance
  const cghsMode = document.getElementById('cghsMode').value;
  const cghsVal = parseFloat(document.getElementById('cghsValue').value) || 0;
  const currCghsAmt = getCalculatedValue(cghsVal, cghsMode, currBasic);
  const revCghsAmt = getCalculatedValue(cghsVal, cghsMode, revisedBasic);

  // Misc Deductions (PT / Tax)
  const miscDedMode = document.getElementById('miscDedMode').value;
  const miscDedVal = parseFloat(document.getElementById('miscDedValue').value) || 0;
  const currMiscDedAmt = getCalculatedValue(miscDedVal, miscDedMode, currBasic);
  const revMiscDedAmt = getCalculatedValue(miscDedVal, miscDedMode, revisedBasic);

  const currTotalDeductions = currNpsAmt + currCghsAmt + currMiscDedAmt + currCustomDeductionsTotal;
  const revTotalDeductions = revNpsAmt + revCghsAmt + revMiscDedAmt + customDeductionsTotal;

  // Net In-Hand
  const currNet = Math.max(0, currGross - currTotalDeductions);
  const revNet = Math.max(0, revGross - revTotalDeductions);

  // Gains
  const netHike = revNet - currNet;
  const pctHike = currNet > 0 ? ((netHike / currNet) * 100).toFixed(1) : '0';

  const currAnnual = currGross * 12;
  const revAnnual = revGross * 12;
  const annualGain = revAnnual - currAnnual;

  // Save current calculated state for printing / PDF
  lastCalcState = {
    currBasic,
    revisedBasic,
    fitmentVal,
    fitmentMode,
    currDaAmt,
    revDaAmt,
    currHraAmt,
    revHraAmt,
    currTaAmt,
    revTaAmt,
    dynamicRowsData,
    currGross,
    revGross,
    currNpsAmt,
    revNpsAmt,
    currCghsAmt,
    revCghsAmt,
    currMiscDedAmt,
    revMiscDedAmt,
    currTotalDeductions,
    revTotalDeductions,
    currNet,
    revNet,
    netHike,
    pctHike,
    currAnnual,
    revAnnual,
    annualGain
  };

  // Update UI Result Display Elements
  document.getElementById('dispRevGross').textContent = formatINR(revGross);
  document.getElementById('dispRevNet').textContent = formatINR(revNet);

  const hikeSign = netHike >= 0 ? '+' : '';
  document.getElementById('dispHikeBadge').innerHTML = `${hikeSign}${formatINR(netHike)}/mo (${hikeSign}${pctHike}% in-hand)`;

  // Update Standard Breakdown Table Rows
  document.getElementById('rowCurrBasic').textContent = formatINR(currBasic);
  document.getElementById('rowRevBasic').textContent = formatINR(revisedBasic);

  document.getElementById('rowCurrDa').textContent = formatINR(currDaAmt);
  document.getElementById('rowRevDa').textContent = formatINR(revDaAmt);

  document.getElementById('rowCurrHra').textContent = formatINR(currHraAmt);
  document.getElementById('rowRevHra').textContent = formatINR(revHraAmt);

  document.getElementById('rowCurrTa').textContent = formatINR(currTaAmt);
  document.getElementById('rowRevTa').textContent = formatINR(revTaAmt);

  // Update Dynamic Custom Rows in Breakdown Table
  renderDynamicTableRows(dynamicRowsData);

  document.getElementById('rowCurrGross').textContent = formatINR(currGross);
  document.getElementById('rowRevGrossTotal').textContent = formatINR(revGross);

  document.getElementById('rowCurrDeductions').textContent = '-' + formatINR(currTotalDeductions);
  document.getElementById('rowRevDeductions').textContent = '-' + formatINR(revTotalDeductions);

  document.getElementById('rowCurrNet').textContent = formatINR(currNet);
  document.getElementById('rowRevNetTotal').textContent = formatINR(revNet);

  // Update Annual Card
  document.getElementById('dispCurrAnnual').textContent = formatINR(currAnnual) + ' / yr';
  document.getElementById('dispRevAnnual').textContent = formatINR(revAnnual) + ' / yr';
  document.getElementById('dispAnnualGain').textContent = (annualGain >= 0 ? '+' : '') + formatINR(annualGain) + ' / yr';
}

function renderDynamicTableRows(rowsData) {
  document.querySelectorAll('.injected-summary-row').forEach(r => r.remove());

  const anchor = document.getElementById('dynamicRowsAnchor');
  if (!anchor) return;

  rowsData.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'injected-summary-row custom-table-row';
    const tag = row.type === 'plus' 
      ? '<span class="custom-tag plus-tag">+ Allowance</span>' 
      : '<span class="custom-tag minus-tag">- Deduction</span>';
    
    tr.innerHTML = `
      <td>${tag} ${escapeHtml(row.name)}</td>
      <td>${formatINR(row.currVal)}</td>
      <td><strong>${formatINR(row.revVal)}</strong></td>
    `;
    anchor.parentNode.insertBefore(tr, anchor);
  });
}

// Prepare the dedicated statement container for print / PDF output
function populatePrintableStatement() {
  const s = lastCalcState;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  
  document.getElementById('printStatementDate').textContent = 'Date: ' + dateFormatted;
  document.getElementById('printMetaOldBasic').textContent = formatINR(s.currBasic);
  document.getElementById('printMetaFitment').textContent = (s.fitmentMode === 'num' ? `${s.fitmentVal}× Ratio` : `${s.fitmentVal}% Hike`);
  document.getElementById('printMetaNewBasic').textContent = formatINR(s.revisedBasic);

  // Deduce approximate level title based on basic pay
  let levelStr = 'Level Reference';
  if (s.currBasic === 18000) levelStr = 'Level 1 (₹18,000)';
  else if (s.currBasic === 35400) levelStr = 'Level 6 (₹35,400)';
  else if (s.currBasic === 44900) levelStr = 'Level 7 (₹44,900)';
  else if (s.currBasic === 56100) levelStr = 'Level 10 (₹56,100)';
  else if (s.currBasic === 78800) levelStr = 'Level 12 (₹78,800)';
  else levelStr = `Basic: ${formatINR(s.currBasic)}`;
  document.getElementById('printMetaLevel').textContent = levelStr;

  const tbody = document.getElementById('printTableBody');
  tbody.innerHTML = '';

  function addRow(name, oldVal, newVal, isGross = false, isNet = false, isDed = false) {
    const tr = document.createElement('tr');
    if (isGross) tr.className = 'statement-gross-row';
    if (isNet) tr.className = 'statement-net-row';

    const diff = newVal - oldVal;
    const diffStr = (diff >= 0 ? '+' : '') + formatINR(diff);
    const oldStr = isDed ? `-${formatINR(oldVal)}` : formatINR(oldVal);
    const newStr = isDed ? `-${formatINR(newVal)}` : formatINR(newVal);

    tr.innerHTML = `
      <td>${name}</td>
      <td style="text-align: right; font-family: monospace;">${oldStr}</td>
      <td style="text-align: right; font-family: monospace;">${newStr}</td>
      <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${diff >= 0 ? '#16a34a' : '#dc2626'};">${diffStr}</td>
    `;
    tbody.appendChild(tr);
  }

  // Base components
  addRow('Basic Pay', s.currBasic, s.revisedBasic);
  addRow('Dearness Allowance (DA)', s.currDaAmt, s.revDaAmt);
  addRow('House Rent Allowance (HRA)', s.currHraAmt, s.revHraAmt);
  addRow('Transport Allowance (TA)', s.currTaAmt, s.revTaAmt);

  // Custom Items
  if (s.dynamicRowsData) {
    s.dynamicRowsData.forEach(item => {
      const prefix = item.type === 'plus' ? '(+) ' : '(-) ';
      addRow(prefix + item.name, item.currVal, item.revVal, false, false, item.type === 'minus');
    });
  }

  // Deductions
  addRow('NPS / Pension Contribution', s.currNpsAmt, s.revNpsAmt, false, false, true);
  addRow('CGHS / Health & Insurance', s.currCghsAmt, s.revCghsAmt, false, false, true);
  addRow('Professional Tax / Misc Deductions', s.currMiscDedAmt, s.revMiscDedAmt, false, false, true);

  // Totals
  addRow('TOTAL GROSS SALARY', s.currGross, s.revGross, true);
  addRow('TOTAL DEDUCTIONS', s.currTotalDeductions, s.revTotalDeductions, false, false, true);
  addRow('NET IN-HAND SALARY (MONTHLY)', s.currNet, s.revNet, false, true);

  // Annual Totals
  document.getElementById('printCurrAnnual').textContent = formatINR(s.currAnnual) + ' / yr';
  document.getElementById('printRevAnnual').textContent = formatINR(s.revAnnual) + ' / yr';
  const gainSign = s.annualGain >= 0 ? '+' : '';
  document.getElementById('printAnnualGain').textContent = gainSign + formatINR(s.annualGain) + ' / yr';
}

// High-fidelity PDF Generation & Download
function downloadPdfStatement() {
  populatePrintableStatement();

  const printElem = document.getElementById('printSalaryStatement');
  printElem.style.display = 'block';

  const pdfBtn = document.getElementById('downloadPdfBtn');
  const btnText = document.getElementById('pdfBtnText');
  const originalText = btnText.textContent;
  btnText.textContent = 'Generating PDF...';
  pdfBtn.disabled = true;

  const fileName = `8th_CPC_Salary_Statement_${Math.round(lastCalcState.revisedBasic || 0)}.pdf`;

  const opt = {
    margin: [10, 10, 10, 10], // top, left, bottom, right in mm
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Check if html2pdf is available
  if (typeof html2pdf !== 'undefined') {
    html2pdf()
      .set(opt)
      .from(printElem)
      .save()
      .then(() => {
        printElem.style.display = 'none';
        btnText.textContent = originalText;
        pdfBtn.disabled = false;
      })
      .catch(err => {
        console.error('PDF generation error:', err);
        printElem.style.display = 'none';
        btnText.textContent = originalText;
        pdfBtn.disabled = false;
        // Fallback to native print if html2pdf fails
        window.print();
      });
  } else {
    // Direct native browser PDF print fallback
    window.print();
    printElem.style.display = 'none';
    btnText.textContent = originalText;
    pdfBtn.disabled = false;
  }
}

// Browser direct print
function triggerBrowserPrint() {
  populatePrintableStatement();
  window.print();
}

// Modal Form Handling for Adding Custom Item
function initModal() {
  const modal = document.getElementById('addItemModal');
  const openBtn = document.getElementById('openAddModalBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelModalBtn');
  const form = document.getElementById('addItemForm');

  const modeNumBtn = document.getElementById('modalModeNumBtn');
  const modePctBtn = document.getElementById('modalModePctBtn');
  const prefixSpan = document.getElementById('modalInputPrefix');
  const suffixSpan = document.getElementById('modalInputSuffix');

  let modalMode = 'pct';

  function openModal() {
    modal.classList.add('open');
    document.getElementById('newItemName').focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    form.reset();
    setModalMode('pct');
  }

  function setModalMode(mode) {
    modalMode = mode;
    modeNumBtn.classList.toggle('active', mode === 'num');
    modePctBtn.classList.toggle('active', mode === 'pct');
    prefixSpan.textContent = mode === 'num' ? '₹' : '%';
    suffixSpan.textContent = mode === 'num' ? 'Rupees' : '% of New Basic';
  }

  modeNumBtn.addEventListener('click', () => setModalMode('num'));
  modePctBtn.addEventListener('click', () => setModalMode('pct'));

  const typeCards = document.querySelectorAll('.type-option-card');
  typeCards.forEach(card => {
    card.addEventListener('click', () => {
      typeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('newItemName').value.trim();
    const value = parseFloat(document.getElementById('newItemValue').value) || 0;
    const typeInput = document.querySelector('input[name="itemType"]:checked');
    const type = typeInput ? typeInput.value : 'plus';

    if (!name) return;

    const newItem = {
      id: 'custom_' + Date.now(),
      name: name,
      type: type,
      mode: modalMode,
      value: value
    };

    customItems.push(newItem);
    renderCustomTabs();
    calculateSalary();
    closeModal();

    const allTabs = getAllTabIds();
    const newIdx = allTabs.indexOf(`tab-${newItem.id}`);
    if (newIdx !== -1) {
      showTab(newIdx);
    }
  });
}

// Reset form
function resetToDefaults() {
  document.getElementById('basicPayInput').value = '44900';

  document.getElementById('fitmentMode').value = 'num';
  document.getElementById('fitmentValue').value = '2.86';

  document.getElementById('currDaMode').value = 'pct';
  document.getElementById('currDaValue').value = '53';

  document.getElementById('revDaMode').value = 'pct';
  document.getElementById('revDaValue').value = '0';

  document.getElementById('hraMode').value = 'pct';
  document.getElementById('hraValue').value = '27';

  document.getElementById('taMode').value = 'num';
  document.getElementById('taValue').value = '3600';

  document.getElementById('npsMode').value = 'pct';
  document.getElementById('npsValue').value = '10';

  document.getElementById('cghsMode').value = 'num';
  document.getElementById('cghsValue').value = '650';

  document.getElementById('miscDedMode').value = 'num';
  document.getElementById('miscDedValue').value = '200';

  customItems = [
    {
      id: 'item_cea',
      name: 'Children Education Allowance (CEA)',
      type: 'plus',
      mode: 'num',
      value: 2250
    }
  ];

  document.querySelectorAll('.toggle-switch-group').forEach(group => {
    const hiddenInput = group.querySelector('input[type="hidden"]');
    if (!hiddenInput) return;
    const mode = hiddenInput.value;
    group.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-val') === mode);
    });
    updatePrefixSuffix(hiddenInput.id, mode);
  });

  renderCustomTabs();
  calculateSalary();
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tabs-nav .tab-btn:not(.add-tab-btn)').forEach((btn, index) => {
    btn.addEventListener('click', () => showTab(index));
  });

  const prevBtn = document.getElementById('prevTabBtn');
  const nextBtn = document.getElementById('nextTabBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => showTab(currentTabIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showTab(currentTabIndex + 1));

  initModeToggles();
  initModal();
  renderCustomTabs();

  // Print & PDF Button Listeners
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', downloadPdfStatement);
  }

  const browserPrintBtn = document.getElementById('browserPrintBtn');
  if (browserPrintBtn) {
    browserPrintBtn.addEventListener('click', triggerBrowserPrint);
  }

  // Live calculation on all number inputs
  document.addEventListener('input', (e) => {
    if (e.target.matches('input[type="number"]') && !e.target.closest('#addItemModal')) {
      calculateSalary();
    }
  });

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetToDefaults);
  }

  calculateSalary();
});
