package rw.ibimina.staff.tapmomo.data

import androidx.room.*

/**
 * Nonce tracking for replay attack prevention
 *
 * A nonce can only be used ONCE within the cache window (default: 10 minutes).
 * Older nonces are automatically purged via cleanup().
 */
@Entity(tableName = "seen_nonce")
data class SeenNonce(
    @PrimaryKey val nonce: String,
    val seenAt: Long  // Unix epoch milliseconds
)

@Dao
interface SeenNonceDao {
    /**
     * Insert a nonce. Returns -1 if already exists (conflict).
     *
     * @return Row ID on success, -1 if duplicate (IGNORE strategy)
     */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    fun insert(n: SeenNonce): Long

    /**
     * Remove nonces older than cutoff timestamp
     *
     * @param cutoff Unix epoch millis; nonces with seenAt < cutoff are deleted
     * @return Number of rows deleted
     */
    @Query("DELETE FROM seen_nonce WHERE seenAt < :cutoff")
    fun cleanup(cutoff: Long): Int

    /**
     * Count total cached nonces (for diagnostics)
     */
    @Query("SELECT COUNT(*) FROM seen_nonce")
    fun count(): Int
}

@Database(entities = [SeenNonce::class], version = 1, exportSchema = false)
abstract class TapMoMoDb : RoomDatabase() {
    abstract fun seenNonce(): SeenNonceDao
}
