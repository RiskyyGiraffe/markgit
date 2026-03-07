import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { executions, purchases, products } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export async function listExecutions(userId: string, limit = 50, offset = 0) {
  const results = await db
    .select({
      id: executions.id,
      purchaseId: executions.purchaseId,
      productId: executions.productId,
      productName: products.name,
      status: executions.status,
      input: executions.input,
      output: executions.output,
      errorMessage: executions.errorMessage,
      startedAt: executions.startedAt,
      completedAt: executions.completedAt,
      createdAt: executions.createdAt,
    })
    .from(executions)
    .innerJoin(purchases, eq(executions.purchaseId, purchases.id))
    .innerJoin(products, eq(executions.productId, products.id))
    .where(eq(purchases.userId, userId))
    .orderBy(desc(executions.createdAt))
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}

export async function getExecution(id: string) {
  const [execution] = await db
    .select()
    .from(executions)
    .where(eq(executions.id, id))
    .limit(1);

  if (!execution) throw new NotFoundError('Execution');
  return execution;
}

export async function getExecutionResult(id: string) {
  const execution = await getExecution(id);

  if (execution.status === 'pending' || execution.status === 'running') {
    return { status: execution.status, output: null };
  }

  return {
    status: execution.status,
    output: execution.output,
    errorMessage: execution.errorMessage,
    completedAt: execution.completedAt,
  };
}
