https://dashboard.stripe.com/
jmark
sT@

go to the top left dropdown
click go to test mode, clicked sandbox first this time

left nav bar
there is a producs catologue
payment links is showing in shortcuts 

click top left dropdown (with the name on it)
click settings
all the things show, 
select developers
there is an api keys option at the top in non obvious lettering
https://dashboard.stripe.com/acct_1SAexoQVYKqBO1rj/test/apikeys

/test/webhooks
brought to /test/workbench/webhooks
then I clicked view workbench
it brought me to /test/dashboard
and a tooltip said pressing w brings up the workbench
that has the webhooks as one of the tabs

can click add destination
got this from render.com where the server is hosted
https://scribefold-api.onrender.com
now have to select the type of events for it to listen to
Webhook Events to Select:
Select these events for your webhook destination:
Subscription Lifecycle:
✅ checkout.session.completed - User completes checkout
✅ customer.subscription.created - Subscription created
✅ customer.subscription.updated - Subscription updated (tier changes)
✅ customer.subscription.deleted - Subscription cancelled
Payment Events:
✅ invoice.payment_succeeded - Monthly payment succeeds (renewal)
✅ invoice.payment_failed - Monthly payment fails

what they are for:
User adds subscription (first time)	checkout.session.completed	✅
Monthly auto-charge (renewal)	invoice.payment_succeeded	✅
User upgrades	customer.subscription.updated	✅
User downgrades	customer.subscription.updated	✅
User cancels	customer.subscription.deleted	✅
Payment fails	invoice.payment_failed

ok now the webhook endpoint is active

test mode
om the top right the go to test mode is now in the "enter sandbox" option hover menu options 

now in the normal account page can press w or clicke the bottom developer bar and workbench comes up
can click webhook option

to get price ids
go to product catalogue on the left
click a product 
where it says products on that page click it
and on the pricing area there is a row with 3 dots on the right, click that 
click copy price id

somwhow I have a product with 4 prices so gonna use those
copied the price id with the 3 dot menu and put in env variables and it is working

in workbench (clicke w in strip web portal)
can click webhooks
then one of them
then to event deliveries
and it shows all of the events that delivered and the status

in the webhook overview there is a edit destination button at the top right that you can use to change the url

---

## Webhook Flow

### stripe_customer_id Set
When: `/s/create-checkout` is called (before user enters payment details)
Where: Saved to users table

### Webhooks and Updates

**invoice.payment_succeeded**
- When: Successful payment (new subscription AND monthly renewal)
- Updates: tokens_monthly, tokens_used_this_month

**customer.subscription.updated**
- When: Plan changes (new subscription, upgrade, downgrade)
- Updates: tier_id, subscription_status, stripe_subscription_id

**customer.subscription.deleted**
- When: Cancellation
- Updates: tier_id to null, tokens_monthly to 0

**invoice.payment_failed**
- When: Payment failure
- Updates: subscription_status to 'past_due'

