/* SPDX-License-Identifier: AGPL-3.0-only */
import { NodeViewWrapper } from "@tiptap/react";
export default function DiagramPlaceholder() {
  return (
    <NodeViewWrapper contentEditable={false}>
      이 MVP에서는 다이어그램 편집을 지원하지 않습니다. 원본 데이터는
      유지됩니다.
    </NodeViewWrapper>
  );
}
