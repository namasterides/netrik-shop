export const metadata = {
  title: 'Privacy Policy | Netrik Shop',
  description: 'Privacy Policy for Netrik Shop - Restaurant OS',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-5 md:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl border border-neutral-200/80 shadow-sm">
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-neutral-600 leading-relaxed">
          <p>
            <strong>Last Updated: {new Date().toLocaleDateString()}</strong>
          </p>

          <p>
            Welcome to Netrik Shop! This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website (https://netrikxr.com) and use our mobile application (the "App").
          </p>

          <h2 className="text-xl font-semibold text-neutral-900 mt-8 mb-4">1. Information We Collect</h2>
          <p>
            We may collect information about you in a variety of ways. The information we may collect includes:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, shipping address, email address, and telephone number, that you voluntarily give to us when you register with the App or when you choose to participate in various activities related to the App.</li>
            <li><strong>Order Data:</strong> Information related to your orders, preferences, and transaction history.</li>
            <li><strong>Device Data:</strong> Information our servers automatically collect when you access the App, such as your native actions that are integral to the App, as well as device information (IP address, operating system, and browser type).</li>
          </ul>

          <h2 className="text-xl font-semibold text-neutral-900 mt-8 mb-4">2. Use of Your Information</h2>
          <p>
            Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the App to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Create and manage your account.</li>
            <li>Process your transactions and deliver the products or services you requested.</li>
            <li>Email you regarding your account or order.</li>
            <li>Increase the efficiency and operation of the App.</li>
            <li>Monitor and analyze usage and trends to improve your experience.</li>
          </ul>

          <h2 className="text-xl font-semibold text-neutral-900 mt-8 mb-4">3. Disclosure of Your Information</h2>
          <p>
            We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information regarding visitors and users with our business partners, trusted affiliates, and advertisers for the purposes outlined above.
          </p>

          <h2 className="text-xl font-semibold text-neutral-900 mt-8 mb-4">4. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
          </p>

          <h2 className="text-xl font-semibold text-neutral-900 mt-8 mb-4">5. Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please contact us at:
            <br /><br />
            <strong>Netrik Shop Support</strong><br />
            Email: contact@netrikxr.com
          </p>
        </div>
      </div>
    </div>
  );
}
