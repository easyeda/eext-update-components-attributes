const RESULT_STORAGE_KEY = 'eext_replace_result_v1';

function escapeHtml(unsafe) {
	if (unsafe == null) return '';
	const s = String(unsafe);
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function loadPayload() {
	try {
		const raw = localStorage.getItem(RESULT_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch (e) {
		console.error('解析结果数据失败', e);
		return null;
	}
}

async function locatePrimitive(row) {
	const id = row.primitiveId;
	const sheet = row.sheetUuid;
	const path = row.projectUuid;
	if (!id) return;

	try {
		if (typeof eda !== 'undefined' && eda?.sys_PrimitivesArea?.locate) {
			await eda.sys_PrimitivesArea.locate({ id, sheet, path, type: 'rect' });
			return;
		}
	} catch (e) {
		console.warn('sys_PrimitivesArea.locate 不可用', e);
	}

	try {
		if (typeof eda !== 'undefined' && eda?.sys_Log?.add) {
			const convertedId = id.replace(/^\$1I/, 'e');
			const span = `<span class="link" data-log-find-id="${escapeHtml(convertedId)}" data-log-find-sheet="${escapeHtml(sheet)}" data-log-find-type="rect" data-log-find-path="${escapeHtml(path)}">${escapeHtml(row.designator || id)}</span>`;
			await eda.sys_Log.add(`🔍 [定位] ${span}`, 'info');
			if (eda.sys_Message?.showToastMessage) {
				await eda.sys_Message.showToastMessage('已写入定位日志，请到日志面板点击位号', 'info');
			}
			return;
		}
	} catch (e) {
		console.warn('sys_Log.add 不可用', e);
	}

	alert('当前环境不支持自动定位，请手动在原理图查找: ' + (row.designator || id));
}

function deviceLabel(device) {
	if (!device) return '';
	return device.name || device.display_title || device.partId || device.title || device.device || 'Device';
}

function openDeviceModal(device) {
	const modal = document.getElementById('deviceModal');
	const title = document.getElementById('deviceModalTitle');
	const content = document.getElementById('deviceModalContent');
	if (!modal || !title || !content) return;
	title.textContent = `器件详情 - ${deviceLabel(device)}`;
	content.textContent = JSON.stringify(device, null, 2);
	modal.classList.remove('hidden');
}

function closeDeviceModal() {
	const modal = document.getElementById('deviceModal');
	if (modal) modal.classList.add('hidden');
}

function buildChangedPropsHtml(row) {
	if (row.status !== 'success') return '<span class="no-change">-</span>';

	const before = row.before || {};
	const after = row.after || {};
	const beforeOther = row.beforeOther || {};
	const afterOther = row.afterOther || {};

	const changes = [];

	const standardProps = [
		{ key: 'manufacturer', label: '制造商', b: before.manufacturer, a: after.manufacturer },
		{ key: 'manufacturerPart', label: '制造商编号', b: before.manufacturerPart, a: after.manufacturerPart },
		{ key: 'supplier', label: '供应商', b: before.supplier, a: after.supplier },
		{ key: 'supplierPart', label: '供应商编号', b: before.supplierPart, a: after.supplierPart },
	];

	standardProps.forEach(({ label, b, a }) => {
		const bStr = b == null ? '' : String(b);
		const aStr = a == null ? '' : String(a);
		if (bStr !== aStr) {
			changes.push(
				`<div class="prop-change"><span class="prop-label">${escapeHtml(label)}:</span> <span class="before">${escapeHtml(bStr || '∅')}</span><span class="arrow">→</span><span class="after">${escapeHtml(aStr || '∅')}</span></div>`,
			);
		}
	});

	const allOtherKeys = new Set([...Object.keys(beforeOther), ...Object.keys(afterOther)]);
	allOtherKeys.forEach((key) => {
		const bVal = beforeOther[key];
		const aVal = afterOther[key];
		const bStr = bVal == null ? '' : String(bVal);
		const aStr = aVal == null ? '' : String(aVal);
		if (bStr !== aStr) {
			changes.push(
				`<div class="prop-change"><span class="prop-label">${escapeHtml(key)}:</span> <span class="before">${escapeHtml(bStr || '∅')}</span><span class="arrow">→</span><span class="after">${escapeHtml(aStr || '∅')}</span></div>`,
			);
		}
	});

	if (changes.length === 0) {
		return '<span class="no-change">无变更</span>';
	}

	return `<div class="changes-list">${changes.join('')}</div>`;
}

function renderRows(rows, payload) {
	const tbody = document.getElementById('resultBody');
	const emptyHint = document.getElementById('emptyHint');
	tbody.innerHTML = '';

	if (!rows.length) {
		emptyHint.classList.remove('hidden');
		return;
	}
	emptyHint.classList.add('hidden');

	const frag = document.createDocumentFragment();
	rows.forEach((row, idx) => {
		const tr = document.createElement('tr');
		const ok = row.status === 'success';
		tr.classList.add('clickable-row');
		tr.dataset.rowIdx = idx;

		const changedPropsHtml = buildChangedPropsHtml(row);

		tr.innerHTML = `
			<td>${idx + 1}</td>
			<td class="designator-cell">${escapeHtml(row.designator)}</td>
			<td>${escapeHtml(row.subPartName)}</td>
			<td><span class="status ${ok ? 'ok' : 'err'}">${ok ? '成功' : '失败'}</span></td>
			<td>${escapeHtml(row.baseKey)}</td>
			<td>${escapeHtml(row.schValue)}</td>
			<td>${escapeHtml(row.queryKey)}</td>
			<td>${escapeHtml(row.libValue)}</td>
			<td>${row.matchedDevice ? `<span class="device-link" data-device-idx="${idx}">Device</span>` : escapeHtml(ok ? '-' : row.failReason || '无匹配')}</td>
			<td class="changes-cell">${changedPropsHtml}</td>
		`;
		frag.appendChild(tr);
	});
	tbody.appendChild(frag);

	tbody.querySelectorAll('tr.clickable-row').forEach((tr) => {
		tr.addEventListener('click', (e) => {
			if (e.target.classList.contains('device-link')) return;
			const idx = Number(tr.dataset.rowIdx);
			const row = rows[idx];
			if (row) locatePrimitive(row);
		});
	});

	tbody.querySelectorAll('.device-link').forEach((link) => {
		link.addEventListener('click', (e) => {
			e.stopPropagation();
			const idx = Number(link.dataset.deviceIdx);
			const row = rows[idx];
			if (row?.matchedDevice) openDeviceModal(row.matchedDevice);
		});
	});
}

function applyFilter(payload) {
	const q = document.getElementById('searchInput').value.trim().toLowerCase();
	const status = document.getElementById('filterStatus').value;

	let rows = payload.rows;
	if (status !== 'all') rows = rows.filter((r) => r.status === status);
	if (q) {
		rows = rows.filter((r) => {
			const blob = [r.designator, r.subPartName, r.baseKey, r.queryKey, r.schValue, r.libValue, r.failReason]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return blob.includes(q);
		});
	}
	renderRows(rows, payload);
}

function exportCsv(payload) {
	const headers = ['#', '位号', '子件名', '状态', '基准属性', '原理图值', '查询属性', '库中值', '匹配库器件', '失败原因', '变更属性'];
	const csvLines = [headers.join(',')];
	payload.rows.forEach((r, i) => {
		const changesText = r.status === 'success' ? '见详情' : '';
		const cells = [
			i + 1,
			r.designator,
			r.subPartName,
			r.status === 'success' ? '成功' : '失败',
			r.baseKey,
			r.schValue,
			r.queryKey,
			r.libValue,
			r.matchedDevice ? deviceLabel(r.matchedDevice) : r.failReason || '',
			r.failReason || '',
			changesText,
		].map((v) => {
			const s = v == null ? '' : String(v);
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		});
		csvLines.push(cells.join(','));
	});
	const blob = new Blob(['﻿' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `replace_result_${Date.now()}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
	const payload = loadPayload() || { rows: [], total: 0, success: 0, failed: 0, mode: '' };

	document.getElementById('totalCount').textContent = payload.total ?? payload.rows.length;
	document.getElementById('successCount').textContent = payload.success ?? payload.rows.filter((r) => r.status === 'success').length;
	document.getElementById('failedCount').textContent = payload.failed ?? payload.rows.filter((r) => r.status !== 'success').length;
	const modeBadge = document.getElementById('modeBadge');
	if (payload.mode) modeBadge.textContent = `模式: ${payload.mode}`;
	else modeBadge.classList.add('hidden');

	applyFilter(payload);

	document.getElementById('searchInput').addEventListener('input', () => applyFilter(payload));
	document.getElementById('filterStatus').addEventListener('change', () => applyFilter(payload));
	document.getElementById('exportBtn').addEventListener('click', () => exportCsv(payload));
	document.getElementById('deviceModalClose').addEventListener('click', closeDeviceModal);
	document.getElementById('deviceModalBackdrop').addEventListener('click', closeDeviceModal);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeDeviceModal();
	});
	document.getElementById('closeBtn').addEventListener('click', async () => {
		try {
			if (typeof eda !== 'undefined' && eda?.sys_IFrame?.closeIFrame) {
				await eda.sys_IFrame.closeIFrame();
			}
		} catch (e) {
			console.warn(e);
		}
	});
});
