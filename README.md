# Weflab Donation Center

React + Vite 프로젝트입니다.

## 페이지

- `/` : 후원 데이터 조회
- `/admin` : 엑셀 업로드 관리자

## 백엔드 API

이 프로젝트는 아래 API가 이미 서버에 존재한다는 전제입니다.

- `POST /weflab-data`
- `GET /weflab-data?page=1&limit=1000`

## 환경변수

`.env.example`을 `.env`로 복사한 뒤 백엔드 주소를 지정하세요.

```env
VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com
```

끝에 `/weflab-data`를 붙이지 말고 서버 기본 주소만 넣습니다.

## 설치 / 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 엑셀 형식

필수 열:

- 시간
- 이름
- 후원,구독
- 채팅

선택 열:

- 멤버
- 마지막숫자 / 점수 / amount / score

원본처럼 마지막 숫자 열의 헤더가 비어 있어도 마지막 열이 숫자라면 자동으로 `마지막숫자`로 전송합니다.

## 대량 데이터

- 업로드: 백엔드에서 500개 단위로 배치 저장
- 조회: 프런트가 `/weflab-data`를 1000개 단위 페이지로 끝까지 순회
- 화면 상세표: 브라우저 렌더링 부하를 줄이기 위해 50/100/250/500개 단위 화면 페이지네이션
