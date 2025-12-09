package rw.ibimina.staff.tapmomo.nfc

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Log
import java.nio.charset.Charset

class Reader(
    private val activity: Activity,
    private val onJson: (String) -> Unit,
    private val onError: (String) -> Unit
) : NfcAdapter.ReaderCallback {
    
    private val TAG = "NfcReader"
    private val nfc by lazy { NfcAdapter.getDefaultAdapter(activity) }

    fun enable() {
        nfc?.enableReaderMode(
            activity,
            this,
            NfcAdapter.FLAG_READER_NFC_A or 
            NfcAdapter.FLAG_READER_NFC_B or 
            NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null
        )
        Log.d(TAG, "Reader mode enabled")
    }

    fun disable() {
        nfc?.disableReaderMode(activity)
        Log.d(TAG, "Reader mode disabled")
    }

    override fun onTagDiscovered(tag: Tag) {
        Log.d(TAG, "Tag discovered: ${tag.id.toHexString()}")
        val iso = IsoDep.get(tag)
        
        if (iso == null) {
            Log.e(TAG, "Not an IsoDep tag")
            onError("Not a compatible NFC device")
            return
        }
        
        try {
            iso.connect()
            iso.timeout = 5000
            
            val select = buildSelectAid("F0494249494D494E41")
            Log.d(TAG, "Sending SELECT: ${select.toHexString()}")
            
            val resp = iso.transceive(select)
            Log.d(TAG, "Received: ${resp.toHexString()}")
            
            val (data, sw) = splitSw(resp)
            
            if (sw == 0x9000) {
                val json = String(data, Charsets.UTF_8)
                Log.d(TAG, "Successfully read payload: $json")
                onJson(json)
            } else {
                Log.e(TAG, "Error SW: ${sw.toString(16)}")
                onError("Failed to read payment data (SW: 0x${sw.toString(16)})")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading tag", e)
            onError("Error reading NFC: ${e.message}")
        } finally {
            try {
                iso.close()
            } catch (_: Exception) {
            }
        }
    }

    private fun splitSw(resp: ByteArray): Pair<ByteArray, Int> {
        if (resp.size < 2) return ByteArray(0) to 0
        val sw = (resp[resp.size - 2].toInt() and 0xFF shl 8) or 
                 (resp.last().toInt() and 0xFF)
        val data = resp.copyOfRange(0, resp.size - 2)
        return data to sw
    }

    private fun buildSelectAid(aidHex: String): ByteArray {
        val aid = aidHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        return byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, aid.size.toByte()) + aid + 0x00
    }
    
    private fun ByteArray.toHexString() = joinToString("") { "%02X".format(it) }
}
