import React from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import type { C4NodeData } from '../../types/c4.types'
import { BaseC4Node } from './BaseC4Node'

type C4SystemNodeProps = NodeProps<Node<C4NodeData>>

export function C4SystemNode({ data, selected }: C4SystemNodeProps): JSX.Element {
  return <BaseC4Node data={data as C4NodeData} selected={selected} />
}
