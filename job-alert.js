import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const email = "atilolasamuel15@gmail.com"

async function sendEmail(){

await resend.emails.send({

from:"Job Alerts <onboarding@resend.dev>",

to:email,

subject:"Daily Remote Developer Jobs",

html:`
<h2>New Remote Job Leads</h2>

<p>Check these platforms today:</p>

<ul>
<li><a href="https://web3.career">Web3 Career</a></li>
<li><a href="https://cryptojobslist.com">Crypto Jobs</a></li>
<li><a href="https://remoteok.com">Remote OK</a></li>
<li><a href="https://weworkremotely.com">We Work Remotely</a></li>
</ul>

<p>Your portfolio:</p>
<a href="https://olabits-landing-page.onrender.com">
https://olabits-landing-page.onrender.com
</a>

`
})

}

sendEmail()
