/* SPDX-License-Identifier: AGPL-3.0-only */
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

const UnavailablePage: ComponentType<any> = () => (
  <main style={{ padding: 32 }}>
    <p>이 기능은 Coders 커뮤니티 버전에서 제공하지 않습니다.</p>
    <Link to="/home">문서로 돌아가기</Link>
  </main>
);
export default UnavailablePage;
export const MfaChallengePage = UnavailablePage;
export const MfaSetupRequiredPage = UnavailablePage;
