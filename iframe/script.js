function escapeHtml(unsafe) {
	if (typeof unsafe !== 'string') return '';
	return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

if (typeof t !== 'function') {
	var edaObj = (typeof eda !== 'undefined') ? eda : (window.parent && window.parent.eda);
	function t(tag, ...args) {
		if (edaObj && edaObj.sys_I18n) return edaObj.sys_I18n.text(tag, undefined, undefined, ...args);
		return tag;
	}
}

async function CloseIFrame() {
	await eda.sys_IFrame.closeIFrame();
}

function removeTrailingDotNumber(str) {
	if (typeof str !== 'string') return str;
	return str.replace(/\.\d+$/, '');
}

function convertId(id) {
	if (typeof id !== 'string') return id;
	return id.replace(/^\$1I/, 'e');
}

function ChangeKey(key) {
	const mapping = {
		'manufacturerId': 'Manufacturer Part',
		'Manufacturer Part': 'manufacturerId',
		'supplierId': 'Supplier Part',
		'Supplier Part': 'supplierId',
		'device': 'subPartName',
	};
	return mapping[key] || key;
}

function bfs(obj, key) {
	if (typeof obj !== 'object' || obj === null) return null;

	const queue = [obj];
	const visited = new WeakSet();

	while (queue.length > 0) {
		const current = queue.shift();

		if (visited.has(current)) continue;
		visited.add(current);

		if (Object.hasOwn(current, key)) return current;

		for (const prop in current) {
			if (Object.hasOwn(current, prop)) {
				const value = current[prop];
				if (typeof value === 'object' && value !== null) {
					queue.push(value);
				}
			}
		}
	}
	return null;
}
/*====================================================以上为基准函数==============================================================================*/

document.addEventListener('DOMContentLoaded', async () => {
	// 使用基准属性去和对应的属性匹配,如果值相等那么就刷新
	const SCH_SELECT = document.getElementById('select1'); //原理图
	const DEVICE_NAME = document.getElementById('select2'); //基准属性
	const SEARCH_LIB = document.getElementById('select3'); //库
	const UPDATE_VALUE = document.getElementById('select4'); //查询属性
	const START_BUTTON = document.getElementById('startbutton');
	const CLOSE_BUTTON = document.getElementById('closebutton');
	const RESULT_BUTTON = document.getElementById('resultbutton');
	const PROGRESS_PANEL = document.getElementById('progressPanel');
	const PROGRESS_BAR = document.getElementById('progressBar');
	const PROGRESS_TEXT = document.getElementById('progressText');
	const TOTAL_COUNT_EL = document.getElementById('totalCount');
	const SUCCESS_COUNT_EL = document.getElementById('successCount');
	const FAILED_COUNT_EL = document.getElementById('failedCount');
	const RESULT_STORAGE_KEY = 'eext_replace_result_v1';
	const SCH_DEVICES_INFO = await eda.sch_PrimitiveComponent.getAll('part', true); //原理图中所有器件数组
	const LIBS_INFO = await eda.lib_LibrariesList.getAllLibrariesList(); //库列表
	const SCH_INFO = await eda.dmt_Schematic.getCurrentSchematicInfo(); //整个项目信息
	/*===============================================以上为全局属性====================================================================================================*/

	function showProgressPanel() {
		PROGRESS_PANEL?.classList.remove('hidden');
	}
	function updateProgress(done, total, success, failed, label) {
		if (!PROGRESS_PANEL) return;
		const pct = total > 0 ? Math.round((done / total) * 100) : 0;
		PROGRESS_BAR.style.width = pct + '%';
		PROGRESS_TEXT.textContent = label || t('Progress_Processing', done, total, pct);
		TOTAL_COUNT_EL.textContent = total;
		SUCCESS_COUNT_EL.textContent = success;
		FAILED_COUNT_EL.textContent = failed;
	}
	async function openResultIFrame() {
		try {
			await eda.sys_IFrame.openIFrame('/iframe/result.html', 1200, 700, 'eext-replace-result');
		} catch (e) {
			console.error(t('Msg_OpenResultFailed'), e);
			await eda.sys_Message.showToastMessage(t('Msg_OpenResultFailed') + e.message, 'error');
		}
	}
	function persistResults(payload) {
		try {
			localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(payload));
		} catch (e) {
			console.error(t('Msg_OpenResultFailed'), e);
		}
	}

	//展示当前原理图
	SCH_SELECT.innerHTML = '';
	const option = document.createElement('option');
	option.value = SCH_INFO.name;
	option.text = SCH_INFO.name;
	SCH_SELECT.add(option);
	SCH_SELECT.disabled = true;
	//属性下拉框
	const TEMP_DEVICES_ARRAY = [];
	let i = 0;
	while (i < SCH_DEVICES_INFO.length) {
		const keys = Object.keys(SCH_DEVICES_INFO[i].getState_OtherProperty());
		TEMP_DEVICES_ARRAY.push(...keys);
		i++;
	}
	// 过滤掉封装相关的属性,防止修改封装
	const FOOTPRINT_KEYS = ['Footprint', 'footprint', 'Package', 'package'];
	const DEVICE_INFO_ARRAY = [...new Set(TEMP_DEVICES_ARRAY)].filter((key) => !FOOTPRINT_KEYS.includes(key));
	DEVICE_INFO_ARRAY.forEach((key) => {
		const option = document.createElement('option');
		option.value = key;
		option.text = key;
		DEVICE_NAME.add(option);

		const option1 = document.createElement('option');
		option1.value = key;
		option1.text = key;
		UPDATE_VALUE.add(option1);
	});
	//库列表
	LIBS_INFO.forEach((lib) => {
		const option = document.createElement('option');
		option.value = lib.uuid;
		option.text = lib.name;
		SEARCH_LIB.add(option);
	});
	/*============================================================以上为UI相关函数======================================================================*/

	async function UpdateDeviceInfo(LibUuid) {
		if (!LibUuid) {
			await eda.sys_Message.showToastMessage(t('Msg_SelectLibrary'), 'error');
			return;
		}

		showProgressPanel();
		PROGRESS_TEXT.textContent = t('Progress_RequestingLibDevices');
		PROGRESS_BAR.style.width = '0%';
		RESULT_BUTTON.disabled = true;
		START_BUTTON.disabled = true;

		const rows = [];
		let success = 0;
		let failed = 0;

		try {
			const res = await fetch(
				`${window.location.origin}/api/v2/devices?path=${encodeURIComponent(LibUuid)}&uid=${encodeURIComponent(LibUuid)}&page=1&pageSize=100000000`,
			);

			if (!res.ok) {
				throw new Error(t('Msg_FetchFailed', res.status, res.statusText));
			}

			const data = await res.json();
			const currentList = data.result?.lists || [];

			if (currentList.length === 0) {
				await eda.sys_Message.showToastMessage(t('Progress_NoDevicesInLib'), 'warning');
				PROGRESS_TEXT.textContent = t('Progress_NoDevicesInLib');
				return;
			}

			const baseKey = ChangeKey(DEVICE_NAME.value);
			const queryKey = UPDATE_VALUE.value;

			if (!baseKey || !queryKey) {
				await eda.sys_Message.showToastMessage(t('Progress_MissingAttrSelection'), 'error');
				PROGRESS_TEXT.textContent = t('Progress_MissingAttrSelection');
				return;
			}

			const deviceMap = new Map();
			for (const device of currentList) {
				const queryValue = bfs(device, queryKey)?.[queryKey];
				if (queryValue != null) {
					const normalizedValue = removeTrailingDotNumber(String(queryValue));
					if (!deviceMap.has(normalizedValue)) {
						deviceMap.set(normalizedValue, device);
					}
				}
			}

			const total = SCH_DEVICES_INFO.length;
			updateProgress(0, total, 0, 0, t('Progress_StartProcessing', total));

			console.log('当前基准属性', baseKey);
			console.log('当前查询属性', queryKey);
			console.log('库中器件索引数量', deviceMap.size);

			let done = 0;
			for (const schDevice of SCH_DEVICES_INFO) {
				const designator = schDevice.getState_Designator();
				const subPartName = schDevice.getState_SubPartName();
				const primitiveId = schDevice.getState_PrimitiveId();
				const beforeOther = (() => {
					try {
						return schDevice.getState_OtherProperty() || {};
					} catch (e) {
						return {};
					}
				})();

				const before = {
					manufacturer:
						typeof schDevice.getState_Manufacturer === 'function' ? schDevice.getState_Manufacturer() : beforeOther['Manufacturer'],
					manufacturerPart:
						typeof schDevice.getState_ManufacturerId === 'function'
							? schDevice.getState_ManufacturerId()
							: beforeOther['Manufacturer Part'],
					supplier: typeof schDevice.getState_Supplier === 'function' ? schDevice.getState_Supplier() : beforeOther['Supplier'],
					supplierPart:
						typeof schDevice.getState_SupplierId === 'function' ? schDevice.getState_SupplierId() : beforeOther['Supplier Part'],
				};

				const baseHit = bfs(schDevice, baseKey);
				let schValue = baseHit?.[baseKey];

				if (schValue == null) {
					failed++;
					done++;
					rows.push({
						designator,
						subPartName,
						status: 'failed',
						baseKey,
						schValue: '',
						queryKey,
						libValue: '',
						matchedDevice: null,
						failReason: t('Msg_NoBaseAttr') + ' "' + baseKey + '"',
						before,
						after: {},
						beforeOther,
						afterOther: {},
						primitiveId,
						sheetUuid: SCH_INFO.page?.[0]?.uuid,
						projectUuid: SCH_INFO.parentProjectUuid,
					});
					const escDes = escapeHtml(designator);
					const escSub = escapeHtml(subPartName);
					const link = `<span class="link" data-log-find-id="${convertId(primitiveId)}" data-log-find-sheet="${SCH_INFO.page[0].uuid}" data-log-find-type="rect" data-log-find-path="${SCH_INFO.parentProjectUuid}">${escDes}</span>`;
					eda.sys_Log.add(`❌ [${t('Log_Failed')}] ${link}, ${escSub} ${t('Log_MissingBaseAttr')} "${escapeHtml(baseKey)}"`, 'error');
					updateProgress(done, total, success, failed, t('Progress_MissingBaseAttr', done, total, designator));
					await eda.sys_Message.showToastMessage(`${done}/${total}`, 'info');
					continue;
				}

				schValue = removeTrailingDotNumber(String(schValue));
				const matchedDevice = deviceMap.get(schValue);

				if (!matchedDevice) {
					failed++;
					done++;
					rows.push({
						designator,
						subPartName,
						status: 'failed',
						baseKey,
						schValue,
						queryKey,
						libValue: '',
						matchedDevice: null,
						failReason: t('Msg_NoMatchDevice'),
						before,
						after: {},
						beforeOther,
						afterOther: {},
						primitiveId,
						sheetUuid: SCH_INFO.page?.[0]?.uuid,
						projectUuid: SCH_INFO.parentProjectUuid,
					});
					const escDes = escapeHtml(designator);
					const escSub = escapeHtml(subPartName);
					const link = `<span class="link" data-log-find-id="${convertId(primitiveId)}" data-log-find-sheet="${SCH_INFO.page[0].uuid}" data-log-find-type="rect" data-log-find-path="${SCH_INFO.parentProjectUuid}">${escDes}</span>`;
					eda.sys_Log.add(`❌ [${t('Log_Failed')}] ${link}, ${escSub} ${t('Log_NoCorrespondingAttr')}`, 'error');
					updateProgress(done, total, success, failed, t('Progress_NoMatch', done, total, designator));
					await eda.sys_Message.showToastMessage(`${done}/${total}`, 'info');
					continue;
				}

				const attributes = matchedDevice?.['attributes'] || {};
				const libValueHit = bfs(matchedDevice, queryKey);
				const libValue = libValueHit?.[queryKey] == null ? '' : String(libValueHit[queryKey]);
				const after = {
					manufacturer: attributes['Manufacturer'],
					manufacturerPart: attributes['Manufacturer Part'],
					supplier: attributes['Supplier'],
					supplierPart: attributes['Supplier Part'],
				};

				const SYSTEM_KEYS = [
					'Designator',
					'Name',
					'Symbol',
					'Footprint',
					'footprint',
					'Package',
					'package',
					'3D Model',
					'3D Model Title',
					'3D Model Transform',
					'Component Type',
					'Primitive Type',
					'SubPart Name',
					'Add into BOM',
					'Convert to PCB',
				];

				const afterOther = {};
				Object.keys(attributes).forEach((k) => {
					if (!SYSTEM_KEYS.includes(k) && k !== 'Manufacturer' && k !== 'Manufacturer Part' && k !== 'Supplier' && k !== 'Supplier Part') {
						afterOther[k] = attributes[k];
					}
				});

				const otherProps = { ...afterOther };

				schDevice.setState_AddIntoBom(attributes['Add into BOM'] === 'yes');
				schDevice.setState_AddIntoPcb(attributes['Convert to PCB'] === 'yes');
				schDevice.setState_Manufacturer(after.manufacturer);
				schDevice.setState_ManufacturerId(after.manufacturerPart);
				schDevice.setState_Supplier(after.supplier);
				schDevice.setState_SupplierId(after.supplierPart);
				schDevice.setState_OtherProperty(otherProps);
				schDevice.done();

				success++;
				done++;
				rows.push({
					designator,
					subPartName,
					status: 'success',
					baseKey,
					schValue,
					queryKey,
					libValue,
					matchedDevice: matchedDevice,
					failReason: '',
					before,
					after,
					beforeOther,
					afterOther,
					primitiveId,
					sheetUuid: SCH_INFO.page?.[0]?.uuid,
					projectUuid: SCH_INFO.parentProjectUuid,
				});

				const escDes = escapeHtml(designator);
				const escSub = escapeHtml(subPartName);
				const matchedName =
					matchedDevice?.name || matchedDevice?.display_title || matchedDevice?.partId || matchedDevice?.title || t('Status_UnknownDevice');
				const link = `<span class="link" data-log-find-id="${convertId(primitiveId)}" data-log-find-sheet="${SCH_INFO.page[0].uuid}" data-log-find-type="rect" data-log-find-path="${SCH_INFO.parentProjectUuid}">${escDes}</span>`;
				eda.sys_Log.add(`✅ [${t('Log_Success')}] ${link}, ${escSub} ${t('Log_AttrRefreshSuccess')} "${escapeHtml(matchedName)}"`, 'info');
				updateProgress(done, total, success, failed, t('Progress_Processing', done, total, Math.round((done / total) * 100)));
				await eda.sys_Message.showToastMessage(`${done}/${total}`, 'info');
			}

			const payload = {
				mode: 'Label_ModeRefresh',
				total,
				success,
				failed,
				rows,
				timestamp: Date.now(),
			};
			persistResults(payload);

			updateProgress(total, total, success, failed, t('Progress_Completed', success, failed));
			await eda.sys_Message.showToastMessage(t('Msg_ComponentReplaceDone'), 'info');
			await eda.sys_Log.add(t('Msg_TaskResult', success, failed), 'info');

			RESULT_BUTTON.disabled = false;
			await openResultIFrame();
		} catch (error) {
			console.error(t('Msg_UpdateFailed'), error);
			PROGRESS_TEXT.textContent = t('Msg_UpdateFailed') + error.message;
			await eda.sys_Message.showToastMessage(t('Msg_UpdateFailed') + error.message, 'error');
			await eda.sys_Log.add(`❌ ${t('Msg_UpdateFailed')}${error.message}`, 'error');
			if (rows.length) {
				persistResults({ mode: 'Label_ModeRefreshInterrupted', total: rows.length, success, failed, rows, timestamp: Date.now() });
				RESULT_BUTTON.disabled = false;
			}
		} finally {
			START_BUTTON.disabled = false;
		}
	}

	START_BUTTON.addEventListener('click', async () => UpdateDeviceInfo(SEARCH_LIB.value));
	CLOSE_BUTTON.addEventListener('click', CloseIFrame);
	RESULT_BUTTON.addEventListener('click', openResultIFrame);
});
