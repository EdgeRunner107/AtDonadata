import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { api, API_BASE_URL } from '../api.js';

const ROUND_OPTIONS = [
  'ARTS1회차',
  'ARTS2회차',
  'ARTS3회차',
  'ARTS4회차',
  'ARTS5회차',
  'ARTS6회차',
  'ARTS7회차',
  'ARTS8회차',
  'ARTS9회차',
  'ARTS10회차',
];

const HEADER_KEYS = {
  time: '시간',
  name: '이름',
  donation: '후원,구독',
  chat: '채팅',
  member: '멤버',
  lastNumber: '마지막숫자',
  round: '회차',
};

const HEADER_ALIASES = {
  time: ['시간', '일시', '날짜'],
  name: ['이름', '닉네임'],
  donation: ['후원,구독', '후원/구독', '후원구독', '후원'],
  chat: ['채팅', '메시지', '내용'],
  member: ['멤버', '멤버명'],
  lastNumber: ['마지막숫자', '마지막 숫자', '금액', 'amount', 'score'],
};

// 수만 건을 한 요청으로 보내면 Vercel/Supabase 제한으로 500 오류가 날 수 있습니다.
const UPLOAD_BATCH_SIZE = 500;

function normalizeHeader(value) {
  return String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();
}

function normalizeTime(value) {
  if (value === undefined || value === null || value === '') return '';

  if (typeof value === 'string') return value.trim();

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const pad = (number) => String(number).padStart(2, '0');
      return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)} ${pad(parsed.H || 0)}:${pad(
        parsed.M || 0
      )}:${pad(Math.floor(parsed.S || 0))}`;
    }
  }

  return String(value).trim();
}

function normalizeLastNumber(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  const text = String(value).trim();
  if (!/^-?[\d,]+$/.test(text)) return null;

  const number = Number(text.replace(/,/g, ''));
  return Number.isSafeInteger(number) ? number : null;
}

function findHeaderIndex(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function hasHeaderRow(row) {
  const candidate = (Array.isArray(row) ? row : []).map(normalizeHeader);

  return ['time', 'name', 'donation', 'chat'].every((key) =>
    HEADER_ALIASES[key].some((alias) => candidate.includes(normalizeHeader(alias)))
  );
}

function rowHasValue(row) {
  return (Array.isArray(row) ? row : []).some(
    (cell) => cell !== '' && cell !== null && cell !== undefined
  );
}

function isRepeatedHeaderRow(row) {
  return (
    normalizeHeader(row[HEADER_KEYS.time]) === normalizeHeader(HEADER_KEYS.time) ||
    (normalizeHeader(row[HEADER_KEYS.name]) === normalizeHeader(HEADER_KEYS.name) &&
      normalizeHeader(row[HEADER_KEYS.donation]) ===
        normalizeHeader(HEADER_KEYS.donation))
  );
}

function splitIntoBatches(rows, size) {
  const batches = [];
  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }
  return batches;
}

function formatRoundLabel(round) {
  return String(round ?? '').replace(/^ARTS(\d+)/, 'ARTS $1');
}

function previewName(value) {
  return String(value ?? '').split('<br>')[0].trim() || '-';
}

function parseWorkbookRows(rows, selectedRound) {
  const sheetRows = Array.isArray(rows) ? rows : [];

  if (sheetRows.length === 0) {
    throw new Error('엑셀 데이터가 없습니다.');
  }

  let headerRowIndex = -1;
  let headers = [];

  for (let rowIndex = 0; rowIndex < Math.min(sheetRows.length, 10); rowIndex += 1) {
    if (hasHeaderRow(sheetRows[rowIndex])) {
      headerRowIndex = rowIndex;
      headers = sheetRows[rowIndex].map(normalizeHeader);
      break;
    }
  }

  const columnIndexes =
    headerRowIndex === -1
      ? {
          time: 0,
          name: 1,
          donation: 2,
          chat: 3,
          member: 4,
          lastNumber: 5,
        }
      : {
          time: findHeaderIndex(headers, HEADER_ALIASES.time),
          name: findHeaderIndex(headers, HEADER_ALIASES.name),
          donation: findHeaderIndex(headers, HEADER_ALIASES.donation),
          chat: findHeaderIndex(headers, HEADER_ALIASES.chat),
          member: findHeaderIndex(headers, HEADER_ALIASES.member),
          lastNumber: findHeaderIndex(headers, HEADER_ALIASES.lastNumber),
        };

  if (
    columnIndexes.time === -1 ||
    columnIndexes.name === -1 ||
    columnIndexes.donation === -1 ||
    columnIndexes.chat === -1
  ) {
    throw new Error('필수 컬럼을 찾지 못했습니다. 시간, 이름, 후원/구독, 채팅을 확인해주세요.');
  }

  const dataRows = sheetRows
    .slice(headerRowIndex === -1 ? 0 : headerRowIndex + 1)
    .filter(rowHasValue);

  const parsed = dataRows.map((row, index) => ({
    _row: index + 1,
    [HEADER_KEYS.time]: normalizeTime(row[columnIndexes.time]),
    [HEADER_KEYS.name]: String(row[columnIndexes.name] ?? '').trim(),
    [HEADER_KEYS.donation]: String(row[columnIndexes.donation] ?? '').trim(),
    [HEADER_KEYS.chat]: String(row[columnIndexes.chat] ?? '').trim(),
    [HEADER_KEYS.member]:
      columnIndexes.member === -1 ? '' : String(row[columnIndexes.member] ?? '').trim(),
    [HEADER_KEYS.lastNumber]:
      columnIndexes.lastNumber === -1
        ? normalizeLastNumber(row[5])
        : normalizeLastNumber(row[columnIndexes.lastNumber]),
    [HEADER_KEYS.round]: selectedRound,
  }));

  const usefulRows = parsed.filter(
    (row) =>
      !isRepeatedHeaderRow(row) &&
      (row[HEADER_KEYS.time] ||
        row[HEADER_KEYS.name] ||
        row[HEADER_KEYS.donation] ||
        row[HEADER_KEYS.chat])
  );

  if (usefulRows.length === 0) {
    throw new Error('업로드할 데이터 행이 없습니다.');
  }

  return usefulRows;
}

export default function AdminPage() {
  const [selectedRound, setSelectedRound] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [result, setResult] = useState(null);
  const [skippedRows, setSkippedRows] = useState([]);

  const totalAmount = useMemo(
    () =>
      previewData.reduce((sum, row) => sum + (Number(row[HEADER_KEYS.lastNumber]) || 0), 0),
    [previewData]
  );

  const canUpload = Boolean(selectedRound && previewData.length > 0 && !uploading);

  const resetUpload = () => {
    setFileName('');
    setPreviewData([]);
    setStatus({ type: '', message: '' });
    setResult(null);
    setSkippedRows([]);
    const input = document.getElementById('excel-upload');
    if (input) input.value = '';
  };

  const handleRoundChange = (event) => {
    const nextRound = event.target.value;
    setSelectedRound(nextRound);
    setResult(null);
    setSkippedRows([]);
    setPreviewData((rows) =>
      rows.map((row) => ({
        ...row,
        [HEADER_KEYS.round]: nextRound,
      }))
    );
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedRound) {
      event.target.value = '';
      setStatus({ type: 'error', message: '회차를 먼저 선택해주세요.' });
      return;
    }

    setFileName(file.name);
    setPreviewData([]);
    setResult(null);
    setSkippedRows([]);
    setStatus({ type: 'loading', message: '엑셀 파싱 중입니다.' });

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target.result, {
          type: 'array',
          cellDates: false,
        });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error('첫 번째 시트를 찾을 수 없습니다.');

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: true,
        });

        const parsed = parseWorkbookRows(rows, selectedRound);
        setPreviewData(parsed);
        setStatus({
          type: 'ready',
          message: `${parsed.length.toLocaleString()}건을 읽었습니다. 미리보기 확인 후 업로드해주세요.`,
        });
      } catch (error) {
        console.error(error);
        setPreviewData([]);
        setStatus({ type: 'error', message: error.message || '파일을 읽지 못했습니다.' });
      }
    };

    reader.onerror = () => {
      setPreviewData([]);
      setStatus({ type: 'error', message: '파일을 읽는 중 오류가 발생했습니다.' });
    };

    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
    if (!canUpload) return;

    try {
      setUploading(true);
      setResult(null);
      setSkippedRows([]);
      setStatus({
        type: 'uploading',
        message: `${previewData.length.toLocaleString()}건 업로드 중입니다.`,
      });

      const data = previewData
        .filter((row) => !isRepeatedHeaderRow(row))
        .map(({ _row, ...row }) => ({
          ...row,
          [HEADER_KEYS.round]: selectedRound,
        }));

      const batches = splitIntoBatches(data, UPLOAD_BATCH_SIZE);
      const uploadResult = {
        received: 0,
        valid: 0,
        unique: 0,
        processed: 0,
        inserted: 0,
        skipped: 0,
      };
      const allSkippedRows = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex];

        setStatus({
          type: 'uploading',
          message: `${batchIndex + 1}/${batches.length} 묶음 업로드 중 · ${uploadResult.inserted.toLocaleString()}건 저장됨`,
        });

        try {
          const response = await api.post(
            '/weflab-data',
            { data: batch },
            { timeout: 60000 }
          );
          const payload = response.data || {};

          uploadResult.received += Number(payload.received ?? batch.length);
          uploadResult.valid += Number(payload.valid ?? batch.length);
          uploadResult.unique += Number(
            payload.unique ?? payload.uniqueInRequest ?? batch.length
          );
          uploadResult.processed += Number(payload.processed ?? 0);
          uploadResult.inserted += Number(payload.inserted ?? payload.returned ?? 0);
          uploadResult.skipped += Number(payload.skipped ?? 0);

          if (Array.isArray(payload.skippedRows)) {
            allSkippedRows.push(...payload.skippedRows);
          }
        } catch (batchError) {
          const serverMessage =
            batchError?.response?.data?.message ||
            batchError?.response?.data?.error ||
            batchError.message ||
            '서버 오류';

          throw new Error(
            `${batchIndex + 1}/${batches.length} 묶음에서 실패했습니다. ` +
              `앞서 저장된 ${uploadResult.inserted.toLocaleString()}건은 유지됩니다. (${serverMessage})`
          );
        }
      }

      setResult(uploadResult);
      setSkippedRows(allSkippedRows);
      setStatus({
        type: 'success',
        message: `업로드 성공: ${uploadResult.inserted.toLocaleString()}건 저장`,
      });
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error.message ||
          '업로드에 실패했습니다.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="page">
      <section className="shell admin-shell admin-mobile">
        <header className="header">
          <Link className="icon-button" to="/" aria-label="조회 페이지">
            <ArrowLeft size={19} />
          </Link>
          <div className="header-copy">
            <p className="eyebrow">WEFLAB ADMIN</p>
            <h1>엑셀 업로드</h1>
          </div>
        </header>

        <section className="hero compact-hero">
          <div>
            <span className="hero-kicker">Donation Data Center</span>
            <h2>회차 선택 후 업로드</h2>
            <p>엑셀 6개 컬럼을 읽고 선택한 회차를 각 행에 추가합니다.</p>
          </div>
          <div className="hero-badge">XLSX</div>
        </section>

        <section className="filter-panel">
          <div className="filter-title">
            <span>업로드 조건</span>
          </div>

          <div className="filter-stack">
            <label className="label" htmlFor="admin-round">
              업로드 회차
            </label>
            <div className="select-box">
              <FileSpreadsheet size={18} />
              <select id="admin-round" value={selectedRound} onChange={handleRoundChange}>
                <option value="">회차를 선택해주세요</option>
                {ROUND_OPTIONS.map((round) => (
                  <option key={round} value={round}>
                    {formatRoundLabel(round)}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} />
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>엑셀 파일 선택</h2>
              <p>.xlsx 또는 .xls · 첫 번째 시트 사용</p>
            </div>
          </div>

          <label className={`upload-box admin-upload-box ${!selectedRound ? 'disabled' : ''}`} htmlFor="excel-upload">
            <FileSpreadsheet size={40} />
            <strong>{fileName || '엑셀 파일을 선택하세요'}</strong>
            <p>
              {selectedRound
                ? `${formatRoundLabel(selectedRound)} 데이터로 미리보기를 만듭니다.`
                : '회차 선택 후 파일을 선택할 수 있습니다.'}
            </p>
            <span className="button-like">파일 선택</span>
          </label>
          <input
            id="excel-upload"
            className="hidden-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </section>

        {status.message && (
          <div className={`status-box admin-status ${status.type}`}>
            {status.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : status.type === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <FileSpreadsheet size={18} />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {previewData.length > 0 && (
          <section className="section-card">
            <div className="section-heading split-heading">
              <div className="heading-left">
                <span>02</span>
                <div>
                  <h2>엑셀 미리보기</h2>
                  <p>
                    {previewData.length.toLocaleString()}건 · 합계 {totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
              <button className="text-button secondary-button" type="button" onClick={resetUpload} disabled={uploading}>
                다시 선택
              </button>
            </div>

            <div className="admin-preview-summary">
              <article>
                <span>선택 회차</span>
                <strong>{formatRoundLabel(selectedRound)}</strong>
              </article>
              <article>
                <span>파일</span>
                <strong>{fileName}</strong>
              </article>
              <article>
                <span>데이터</span>
                <strong>{previewData.length.toLocaleString()}건</strong>
              </article>
            </div>

            <div className="admin-mobile-preview">
              {previewData.slice(0, 20).map((row) => (
                <article className="admin-preview-card" key={row._row}>
                  <strong>{previewName(row[HEADER_KEYS.name])}</strong>
                  <span>{row[HEADER_KEYS.donation] || '-'}</span>
                  <p>{row[HEADER_KEYS.chat] || '-'}</p>
                  <div>
                    <span>{row[HEADER_KEYS.member] || '-'}</span>
                    <b>
                      {row[HEADER_KEYS.lastNumber] === null
                        ? '-'
                        : row[HEADER_KEYS.lastNumber].toLocaleString()}
                    </b>
                  </div>
                </article>
              ))}
            </div>

            <div className="table-wrap preview-wrap excel-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>시간</th>
                    <th>이름</th>
                    <th>후원/구독</th>
                    <th>채팅</th>
                    <th>멤버</th>
                    <th>마지막숫자</th>
                    <th>회차</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 500).map((row) => (
                    <tr key={row._row}>
                      <td className="muted-cell">{row._row}</td>
                      <td className="nowrap">{row[HEADER_KEYS.time] || '-'}</td>
                      <td className="name-cell">{row[HEADER_KEYS.name] || '-'}</td>
                      <td className="nowrap">{row[HEADER_KEYS.donation] || '-'}</td>
                      <td className="chat-cell">{row[HEADER_KEYS.chat] || '-'}</td>
                      <td>{row[HEADER_KEYS.member] || '-'}</td>
                      <td className="number-cell score-cell">
                        {row[HEADER_KEYS.lastNumber] === null
                          ? '-'
                          : row[HEADER_KEYS.lastNumber].toLocaleString()}
                      </td>
                      <td>{row[HEADER_KEYS.round]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.length > 500 && (
              <p className="helper-text">
                표 미리보기는 처음 500건만 표시합니다. 실제 업로드는 전체{' '}
                {previewData.length.toLocaleString()}건을 전송합니다.
              </p>
            )}

            <div className="admin-actions">
              <button
                className="primary-button full-button"
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
              >
                <Upload size={18} />
                {uploading ? '업로드 중...' : `${previewData.length.toLocaleString()}건 업로드`}
              </button>
            </div>
          </section>
        )}

        {result && (
          <section className="section-card">
            <div className="section-heading">
              <span>03</span>
              <div>
                <h2>업로드 완료</h2>
                <p>서버 처리 결과</p>
              </div>
            </div>

            <div className="metric-grid four">
              <article>
                <span>전체</span>
                <strong>{result.received.toLocaleString()}</strong>
              </article>
              <article>
                <span>정상</span>
                <strong>{result.valid.toLocaleString()}</strong>
              </article>
              <article>
                <span>중복제거</span>
                <strong>{result.unique.toLocaleString()}</strong>
              </article>
              <article>
                <span>저장</span>
                <strong>{result.inserted.toLocaleString()}</strong>
              </article>
              <article>
                <span>제외</span>
                <strong>{result.skipped.toLocaleString()}</strong>
              </article>
            </div>

            {skippedRows.length > 0 && (
              <div className="result-note">
                <strong>오류 목록</strong>
                {skippedRows.slice(0, 20).map((row, index) => (
                  <p key={`${index}-${JSON.stringify(row)}`}>{JSON.stringify(row)}</p>
                ))}
              </div>
            )}
          </section>
        )}

        <footer>{API_BASE_URL}/weflab-data</footer>
      </section>
    </main>
  );
}
