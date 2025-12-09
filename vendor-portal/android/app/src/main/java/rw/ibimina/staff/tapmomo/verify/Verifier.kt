package rw.ibimina.staff.tapmomo.verify

import android.content.Context
import android.util.Log
import androidx.room.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import rw.ibimina.staff.tapmomo.crypto.Canonical
import rw.ibimina.staff.tapmomo.crypto.Hmac
import rw.ibimina.staff.tapmomo.data.SeenNonce
import rw.ibimina.staff.tapmomo.data.TapMoMoDb
import rw.ibimina.staff.tapmomo.model.Payload

class Verifier(ctx: Context) {
    private val TAG = "TapMoMoVerifier"
    private val db = Room.databaseBuilder(ctx, TapMoMoDb::class.java, "tapmomo.db")
        .fallbackToDestructiveMigration()
        .build()

    fun parse(json: String): Payload {
        val o = JSONObject(json)
        return Payload(
            ver = o.getInt("ver"),
            network = o.getString("network"),
            merchantId = o.getString("merchantId"),
            currency = o.getString("currency"),
            amount = if (o.isNull("amount")) null else o.getInt("amount"),
            ref = if (o.has("ref") && !o.isNull("ref")) o.getString("ref") else null,
            ts = o.getLong("ts"),
            nonce = o.getString("nonce"),
            sig = o.getString("sig")
        )
    }

    suspend fun validate(
        p: Payload,
        merchantKey: ByteArray,
        ttlMs: Long = 120_000, // 2 minutes
        futureSkewMs: Long = 60_000 // 1 minute
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val now = System.currentTimeMillis()
            
            // Check timestamp
            if (now - p.ts > ttlMs) {
                Log.w(TAG, "Payload expired: now=$now, ts=${p.ts}, diff=${now - p.ts}ms")
                return@withContext Result.failure(IllegalStateException("Payment request expired"))
            }
            
            if (p.ts - now > futureSkewMs) {
                Log.w(TAG, "Payload from future: now=$now, ts=${p.ts}")
                return@withContext Result.failure(IllegalStateException("Invalid timestamp"))
            }

            // Check nonce replay
            val dao = db.seenNonce()
            dao.cleanup(now - 10 * 60_000L) // 10 minutes
            
            val inserted = dao.insert(SeenNonce(p.nonce, now))
            if (inserted == -1L) {
                Log.w(TAG, "Nonce replay detected: ${p.nonce}")
                return@withContext Result.failure(IllegalStateException("Duplicate payment request"))
            }

            // Verify signature
            val canon = Canonical.canonicalWithoutSig(p)
            val expect = Hmac.sha256B64(merchantKey, canon)
            
            if (expect == p.sig) {
                Log.d(TAG, "Signature verified successfully")
                Result.success(Unit)
            } else {
                Log.w(TAG, "Signature mismatch: expected=$expect, got=${p.sig}")
                Result.failure(IllegalStateException("Invalid signature"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Validation error", e)
            Result.failure(e)
        }
    }
}
