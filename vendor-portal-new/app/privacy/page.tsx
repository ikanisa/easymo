export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="prose dark:prose-invert max-w-none">
        <h1>Privacy Policy - SMS Ingestion Feature</h1>

        <p className="text-lg text-gray-600 dark:text-gray-300">Last Updated: October 31, 2025</p>

        <h2>Overview</h2>
        <p>
          The Ibimina Staff Console includes an optional SMS ingestion feature for staff members
          using the Android mobile app. This feature automates the processing of mobile money
          payment notifications to streamline payment reconciliation and member account management.
        </p>

        <h2>What Information We Collect</h2>

        <h3>SMS Messages</h3>
        <p>
          When you enable SMS ingestion, the app accesses and reads SMS messages from your device's
          inbox. However, we only process messages that match specific criteria:
        </p>
        <ul>
          <li>
            <strong>Sender filtering:</strong> Only messages from known mobile money service
            providers (MTN MoMo, Airtel Money) are read
          </li>
          <li>
            <strong>Content type:</strong> Only payment confirmation messages are processed
          </li>
          <li>
            <strong>No personal SMS:</strong> Personal messages, conversations, and SMS from other
            senders are never accessed or processed
          </li>
        </ul>

        <h3>Data Extracted from SMS</h3>
        <p>From qualifying mobile money SMS messages, we extract:</p>
        <ul>
          <li>Transaction amount and currency</li>
          <li>Transaction ID and timestamp</li>
          <li>Sender phone number (encrypted before storage)</li>
          <li>Payment reference code (if included)</li>
          <li>Payer name (if included in SMS)</li>
        </ul>

        <h2>How We Use This Information</h2>
        <p>The extracted payment information is used exclusively to:</p>
        <ul>
          <li>Match payments to SACCO members based on reference codes</li>
          <li>Automatically allocate payments to member accounts</li>
          <li>Generate reconciliation reports for staff</li>
          <li>Maintain accurate financial records</li>
          <li>Reduce manual data entry and human error</li>
        </ul>

        <h2>Data Storage and Security</h2>

        <h3>Local Device</h3>
        <p>
          SMS messages are <strong>not stored</strong> on your device by the Ibimina app. Messages
          are read, processed, and immediately transmitted to our secure backend servers.
        </p>

        <h3>Backend Storage</h3>
        <ul>
          <li>
            <strong>Encryption:</strong> Phone numbers are encrypted using AES-256 encryption before
            storage
          </li>
          <li>
            <strong>Hashing:</strong> Phone numbers are also hashed for duplicate detection and
            matching
          </li>
          <li>
            <strong>Masking:</strong> Displayed phone numbers are masked (e.g., +25078****123)
          </li>
          <li>
            <strong>Secure transmission:</strong> All data is transmitted over HTTPS with HMAC
            authentication
          </li>
          <li>
            <strong>Access control:</strong> Database access is restricted with Row-Level Security
            (RLS) policies
          </li>
          <li>
            <strong>Audit logs:</strong> All data access and modifications are logged for security
            monitoring
          </li>
        </ul>

        <h2>Background Sync</h2>
        <p>
          When SMS ingestion is enabled, the app performs periodic background checks (default: every
          15 minutes) to detect new mobile money SMS. This background process:
        </p>
        <ul>
          <li>Only runs when enabled by you in settings</li>
          <li>Respects Android battery optimization settings</li>
          <li>Requires network connectivity to send data</li>
          <li>Can be configured or disabled at any time</li>
        </ul>

        <h2>Your Rights and Controls</h2>

        <h3>You Can:</h3>
        <ul>
          <li>
            <strong>Enable or disable:</strong> Turn SMS ingestion on or off at any time in Settings
          </li>
          <li>
            <strong>Revoke permissions:</strong> Remove SMS permissions through Android system
            settings
          </li>
          <li>
            <strong>Configure sync interval:</strong> Adjust how frequently the app checks for new
            messages
          </li>
          <li>
            <strong>View processed data:</strong> See what SMS messages have been ingested and
            processed
          </li>
          <li>
            <strong>Request deletion:</strong> Contact your SACCO administrator to request deletion
            of specific records
          </li>
        </ul>

        <h3>Data Retention</h3>
        <p>
          Raw SMS text and parsed payment data are retained according to SACCO financial record
          retention requirements (typically 7 years). Encrypted phone numbers are retained for the
          same period to support auditing and reconciliation.
        </p>

        <h2>Permissions Required</h2>
        <p>The SMS ingestion feature requires the following Android permissions:</p>
        <ul>
          <li>
            <strong>READ_SMS:</strong> To query the SMS inbox for mobile money messages
          </li>
          <li>
            <strong>RECEIVE_SMS:</strong> To detect new SMS arrivals for near-real-time processing
          </li>
        </ul>
        <p>
          These permissions are only requested when you choose to enable SMS ingestion. The feature
          is entirely optional, and the app functions fully without these permissions.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          Payment parsing uses OpenAI's API for SMS text extraction when regex patterns fail. When
          this occurs:
        </p>
        <ul>
          <li>SMS text is sent to OpenAI for structured data extraction</li>
          <li>Phone numbers and personal identifiers are redacted before sending</li>
          <li>OpenAI does not store or train models on this data (zero-retention policy)</li>
          <li>Communication is encrypted with TLS 1.3</li>
        </ul>

        <h2>Compliance</h2>
        <p>This feature complies with:</p>
        <ul>
          <li>
            Android SMS permission policies (internal distribution exemption for financial apps)
          </li>
          <li>Rwanda Data Protection and Privacy Law (if applicable)</li>
          <li>SACCO financial record-keeping regulations</li>
        </ul>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this privacy policy to reflect changes in our practices or legal
          requirements. Material changes will be communicated through in-app notifications.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about SMS ingestion, data privacy, or to exercise your rights, contact your
          SACCO administrator or the Ibimina support team.
        </p>

        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
            Important Note
          </h3>
          <p className="text-blue-800 dark:text-blue-200">
            This SMS ingestion feature is designed exclusively for staff members to facilitate their
            work managing SACCO operations. It is not intended for, and should not be used on,
            personal or non-work devices. Only enable this feature on a device designated for SACCO
            staff duties.
          </p>
        </div>
      </div>
    </div>
  );
}
