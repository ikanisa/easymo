import { Button } from "@/components/ui/Button";
import type { IbiminaRow } from "@/lib/baskets/baskets-service";
import styles from "./IbiminaRegistryTable.module.css";

type IbiminaListTableProps = {
  rows: IbiminaRow[];
  total: number;
  onRefresh: () => void;
  onReview: (row: IbiminaRow) => void;
  onStatusChange: (input: {
    id: string;
    status: IbiminaRow["status"];
  }) => void;
  isRefreshing: boolean;
  isStatusUpdating: boolean;
};

function formatCommitteeSummary(row: IbiminaRow) {
  const expectedRoles = ["president", "vp", "secretary", "treasurer"];
  const presentRoles = row.committee.map((member) => member.role);
  const missingRoles = expectedRoles.filter((role) => !presentRoles.includes(role));

  return (
    <>
      <span>{presentRoles.length}/4 filled</span>
      {missingRoles.length ? (
        <span className={styles.committeeMissing}>
          Missing: {missingRoles.join(", ")}
        </span>
      ) : null}
      {row.quorum
        ? (
          <span className={styles.committeeMeta}>
            Quorum: {row.quorum.threshold ?? row.committee.length}
            {row.quorum.roles.length
              ? ` approvals • roles: ${row.quorum.roles.join(", ")}`
              : " approvals"}
          </span>
        )
        : null}
    </>
  );
}

export function IbiminaListTable({
  rows,
  total,
  onRefresh,
  onReview,
  onStatusChange,
  isRefreshing,
  isStatusUpdating,
}: IbiminaListTableProps) {
  return (
    <div>
      <div className={styles.headerRow}>
        <span className={styles.counter}>{total} ikimina</span>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>SACCO</th>
              <th>Committee</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className={styles.slugCell}>{row.slug}</td>
                <td>
                  {row.sacco
                    ? `${row.sacco.name}${row.sacco.branchCode ? ` • ${row.sacco.branchCode}` : ""}`
                    : "—"}
                </td>
                <td className={styles.committeeCell}>
                  {formatCommitteeSummary(row)}
                </td>
                <td>
                  <select
                    className={styles.statusSelect}
                    value={row.status}
                    onChange={(event) =>
                      onStatusChange({
                        id: row.id,
                        status: event.target.value as IbiminaRow["status"],
                      })}
                    disabled={isStatusUpdating}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReview(row)}
                  >
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
