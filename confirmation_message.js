import emailjs from '@emailjs/browser'

async function sendConfirmation(title, url, toEmail) {
  const templateParams = {
    title: title,
    url: url,
    to_email: toEmail
  }

  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    templateParams,
    process.env.EMAILJS_PUBLIC_KEY
  )
}