import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  RefreshCw,
  Settings,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  API_BASE_URL,
  fetchWeflabDataByRound,
  fetchWeflabRounds,
} from '../api.js';

const numberFormat = new Intl.NumberFormat('ko-KR');

function formatRoundLabel(round) {
  return String(round ?? '').replace(/^ARTS(\d+)/, 'ARTS $1');
}

function formatDateTime(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').replace('Z', '').slice(0, 19);
}

function getValidAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getTimeValue(value) {
  if (!value) return 0;
  const normalized = String(value).replace(' ', 'T');
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getDetailDisplayValue(row) {
  const amount = getValidAmount(row?.amount);

  if (amount !== null) {
    return `${numberFormat.format(amount)}개`;
  }

  return String(row?.donation_value ?? '-').trim() || '-';
}

function buildDonorSummary(rows) {
  const donorMap = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const nickname = String(row?.nickname ?? '').trim();
    const amount = getValidAmount(row?.amount);

    if (!nickname || amount === null) return;

    const previous = donorMap.get(nickname) ?? {
      nickname,
      totalAmount: 0,
      count: 0,
    };

    previous.totalAmount += amount;
    previous.count += 1;
    donorMap.set(nickname, previous);
  });

  return [...donorMap.values()].sort(
    (a, b) =>
      b.totalAmount - a.totalAmount ||
      b.count - a.count ||
      a.nickname.localeCompare(b.nickname, 'ko-KR')
  );
}

export default function ViewerPage() {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [roundRows, setRoundRows] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadRounds = async () => {
    try {
      setRoundsLoading(true);
      setError('');
      const result = await fetchWeflabRounds();
      setRounds(Array.isArray(result.rounds) ? result.rounds : []);
    } catch (err) {
      console.error('Weflab rounds error:', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          '회차 목록을 불러오지 못했습니다.'
      );
    } finally {
      setRoundsLoading(false);
    }
  };

  const loadRoundRows = async (round) => {
    if (!round) {
      setRoundRows([]);
      return;
    }

    try {
      setDataLoading(true);
      setError('');
      const result = await fetchWeflabDataByRound(round);
      setRoundRows(Array.isArray(result.rows) ? result.rows : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Weflab round data error:', err);
      setRoundRows([]);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          '회차 데이터를 불러오지 못했습니다.'
      );
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadRounds();
  }, []);

  const handleRoundChange = (event) => {
    const nextRound = event.target.value;
    setSelectedRound(nextRound);
    setSelectedMember('');
    loadRoundRows(nextRound);
  };

  const handleMemberChange = (event) => {
    setSelectedMember(event.target.value);
  };

  const refreshCurrent = () => {
    if (selectedRound) {
      loadRoundRows(selectedRound);
      return;
    }

    loadRounds();
  };

  const members = useMemo(() => {
    const values = (Array.isArray(roundRows) ? roundRows : [])
      .map((row) => String(row?.member ?? '').trim())
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [roundRows]);

  // 1. 선택 멤버 원본
  const memberRows = useMemo(() => {
    if (!selectedMember) return [];

    return (Array.isArray(roundRows) ? roundRows : []).filter(
      (row) => String(row?.member ?? '').trim() === selectedMember
    );
  }, [roundRows, selectedMember]);

  const validDonationRows = useMemo(
    () => memberRows.filter((row) => getValidAmount(row?.amount) !== null),
    [memberRows]
  );

  // 2. 후원자별 합계
  const donorSummary = useMemo(() => buildDonorSummary(memberRows), [memberRows]);

  // 3. 전체 건별 내역
  const detailRows = useMemo(() => {
    return [...memberRows].sort((a, b) => {
      const timeCompare = getTimeValue(b?.event_time) - getTimeValue(a?.event_time);
      if (timeCompare !== 0) return timeCompare;
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    });
  }, [memberRows]);

  const totalAmount = useMemo(
    () => validDonationRows.reduce((sum, row) => sum + (getValidAmount(row?.amount) ?? 0), 0),
    [validDonationRows]
  );

  const donationCount = validDonationRows.length;

  const donorCount = useMemo(() => {
    const donors = validDonationRows
      .map((row) => String(row?.nickname ?? '').trim())
      .filter(Boolean);

    return new Set(donors).size;
  }, [validDonationRows]);

  const showDonorEmpty =
    selectedRound && selectedMember && !dataLoading && donorSummary.length === 0;

  return (
    <main className="viewer-page">
      <div className="viewer-container mobile">
        <header className="viewer-header">
          <div>
            <div className="viewer-eyebrow">ARTs DATA</div>
            <h1>회차 / 멤버 데이터 조회</h1>
          </div>

          <div className="viewer-header-actions">
            <Link to="/admin" className="viewer-icon-btn" aria-label="관리자">
              <Settings size={20} />
            </Link>
            <button
              type="button"
              className="viewer-icon-btn"
              onClick={refreshCurrent}
              disabled={roundsLoading || dataLoading}
              aria-label="새로고침"
            >
              <RefreshCw
                size={20}
                className={roundsLoading || dataLoading ? 'viewer-spin' : ''}
              />
            </button>
          </div>
        </header>

        <section className="viewer-hero compact-viewer-hero">
          <div className="viewer-hero-content">
            <span>Donation Data Center</span>
            <h2>회차별 멤버 조회</h2>
            <p>회차를 선택한 뒤 멤버별 후원자 합계와 전체 내역을 확인합니다.</p>
          </div>
        </section>

        {error && (
          <div className="viewer-error">
            <span>{error}</span>
            <button type="button" onClick={refreshCurrent}>
              다시 시도
            </button>
          </div>
        )}

        <section className="filter-panel">
          <div className="filter-title">
            <span>조회 조건</span>
          </div>

          <div className="filter-stack">
            <label className="label" htmlFor="viewer-round">
              회차 선택
            </label>
            <div className="select-box">
              <CalendarDays size={18} />
              <select
                id="viewer-round"
                value={selectedRound}
                onChange={handleRoundChange}
                disabled={roundsLoading}
              >
                <option value="">
                  {roundsLoading ? '회차 목록 로딩 중' : '회차를 선택해주세요'}
                </option>
                {rounds.map((round) => (
                  <option key={round} value={round}>
                    {formatRoundLabel(round)}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} />
            </div>

            <label className="label" htmlFor="viewer-member">
              멤버 선택
            </label>
            <div className="select-box">
              <Users size={18} />
              <select
                id="viewer-member"
                value={selectedMember}
                onChange={handleMemberChange}
                disabled={!selectedRound || dataLoading || members.length === 0}
              >
                <option value="">
                  {!selectedRound
                    ? '회차를 먼저 선택'
                    : dataLoading
                      ? '회차 데이터 로딩 중'
                      : members.length === 0
                        ? '선택 가능한 멤버 없음'
                        : '멤버를 선택해주세요'}
                </option>
                {members.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} />
            </div>
          </div>
        </section>

        {!selectedRound && (
          <div className="select-empty">조회할 회차를 선택해주세요.</div>
        )}

        {selectedRound && !selectedMember && !dataLoading && (
          <div className="select-empty">조회할 멤버를 선택해주세요.</div>
        )}

        {dataLoading && (
          <div className="select-empty">회차 데이터를 불러오는 중입니다.</div>
        )}

        {selectedRound && selectedMember && !dataLoading && (
          <>
            <section className="selected-banner">
              <span>{formatRoundLabel(selectedRound)}</span>
              <strong>{selectedMember}</strong>
            </section>

            <section className="mini-stats">
              <article>
                <WalletCards size={17} />
                <span>총 후원</span>
                <strong>{numberFormat.format(totalAmount)} P</strong>
              </article>
              <article>
                <CalendarDays size={17} />
                <span>후원 건수</span>
                <strong>{numberFormat.format(donationCount)}건</strong>
              </article>
              <article>
                <Users size={17} />
                <span>후원자 수</span>
                <strong>{numberFormat.format(donorCount)}명</strong>
              </article>
            </section>

            <section className="section viewer-detail-section">
              <div className="section-title split-heading">
                <div>
                  <h2>후원자별 합계</h2>
                  <p className="helper-text">닉네임별 누적 후원량</p>
                </div>
              </div>

              <div className="viewer-detail-count">
                후원자 <strong>{numberFormat.format(donorSummary.length)}</strong>명
              </div>

              <div className="viewer-mobile-list">
                {showDonorEmpty ? (
                  <div className="viewer-empty">
                    {memberRows.length === 0 ? '데이터 없음' : '유효 후원 데이터 없음'}
                  </div>
                ) : (
                  donorSummary.map((donor, index) => (
                    <article className="viewer-donation-card donor-summary-card" key={donor.nickname}>
                      <div className="viewer-donation-top">
                        <div>
                          <span className="rank-cell">{index + 1}</span>
                          <strong>{donor.nickname}</strong>
                        </div>
                        <div className="viewer-donation-amount">
                          {numberFormat.format(donor.totalAmount)}
                          <small>개</small>
                        </div>
                      </div>

                      <div className="viewer-donation-meta">
                        <span>총 후원 {numberFormat.format(donor.totalAmount)}개</span>
                        <b>{numberFormat.format(donor.count)}회</b>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="viewer-desktop-table excel-table donor-table">
                <table>
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>후원자</th>
                      <th>총 후원</th>
                      <th>횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donorSummary.map((donor, index) => (
                      <tr key={donor.nickname}>
                        <td className="rank-cell">{index + 1}</td>
                        <td>{donor.nickname}</td>
                        <td className="number-cell score-cell">
                          {numberFormat.format(donor.totalAmount)}
                        </td>
                        <td className="number-cell">{numberFormat.format(donor.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section viewer-detail-section">
              <div className="section-title split-heading">
                <div>
                  <h2>전체 후원 내역</h2>
                  <p className="helper-text">선택한 멤버에게 들어온 전체 후원 건별 내역입니다.</p>
                </div>
                <span className="type-badge">{numberFormat.format(detailRows.length)}건</span>
              </div>

              <div className="viewer-mobile-list detail-event-list">
                {detailRows.length === 0 ? (
                  <div className="viewer-empty">전체 후원 내역이 없습니다.</div>
                ) : (
                  detailRows.map((row, index) => (
                    <article
                      className="viewer-donation-card detail-event-card"
                      key={row?.id ?? `${row?.event_time}-${row?.nickname}-${index}`}
                    >
                      <div className="viewer-donation-top">
                        <div>
                          <strong>{row?.nickname || '-'}</strong>
                          {row?.text && <span>{row.text}</span>}
                        </div>
                        <div className="viewer-donation-amount">
                          {getDetailDisplayValue(row)}
                        </div>
                      </div>

                      <div className="viewer-donation-meta">
                        <span>{formatDateTime(row?.event_time)}</span>
                        <b>{String(row?.donation_value ?? '').trim() || '-'}</b>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="viewer-desktop-table excel-table">
                <table>
                  <thead>
                    <tr>
                      <th>닉네임</th>
                      <th>후원/구독</th>
                      <th>채팅</th>
                      <th>시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, index) => (
                      <tr key={row?.id ?? `${row?.event_time}-${row?.nickname}-${index}`}>
                        <td>{row?.nickname || '-'}</td>
                        <td className="number-cell score-cell">{getDetailDisplayValue(row)}</td>
                        <td>{row?.text || '-'}</td>
                        <td>{formatDateTime(row?.event_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer className="viewer-footer">
          <span>API</span>
          {selectedRound
            ? `${API_BASE_URL}/weflab-data/all?round=${selectedRound}`
            : `${API_BASE_URL}/weflab-rounds`}
          {lastUpdated && (
            <small>
              마지막 조회{' '}
              {lastUpdated.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </small>
          )}
        </footer>
      </div>
    </main>
  );
}
