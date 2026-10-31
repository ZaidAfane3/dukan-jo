# Selling domains through Dukkan (backend notes)

Merchants can buy a domain on the domain page (`/domain`). Dukkan acts as the middle man: it registers the domain through a registrar's reseller account, takes the payment, connects the domain to the store and renews it.

The prototype runs all of this in the browser and pretends. `components/domainShop.ts` has the two calls the page makes:

| Call | Prototype | Backend |
|---|---|---|
| `searchDomains(name)` | Makes up which endings are free (the same answer every time) and uses fixed prices | Asks the registrar which endings are free and their cost, then adds Dukkan's margin |
| `buyDomain(offer, years, autoRenew)` | Adds the domain to the list in this browser | Takes the payment, registers the domain, sets DNS to the store, saves it on the account |

The answers stay the same shape, so the page doesn't change when the backend arrives.

## What the backend needs

- **Registrar reseller account:** an API for checking availability, registering, renewing, and transferring out, for .com, .net, .store, .shop and .online.
- **.jo and .com.jo:** these are registered with Jordan's national registry and need a Jordanian commercial registration. The page already tells the merchant this paper will be asked for after buying. Decide how it is collected and checked.
- **Payment:** charge the total for the chosen years. Refunds and failed registrations need a rule. If the registration fails after payment, either refund automatically or retry.
- **Owner details (WHOIS):** register in the merchant's name with privacy protection where the ending allows it.
- **Connecting to the store:** set the domain's DNS to the store and issue an SSL certificate automatically. Then the status shows "Active".
- **Renewal:** auto-renew is on by default. Send a reminder 30 days and 7 days before the end date, and charge the saved payment method. If renewal fails, warn the merchant before the domain expires.
- **Transfer out:** a merchant who leaves Dukkan can get the transfer code. Registrars often lock this for 60 days after purchase.
- **Prices:** prices in `ENDINGS` are placeholders in JOD. The real prices come from the registrar's cost plus Dukkan's margin, decided by the team.

## Open questions for the team

1. Which registrar to resell through?
2. Dukkan's margin per ending?
3. Refund rule when registration fails, and when a merchant cancels in the first days?
4. Should a domain bought through Dukkan be removable from the list while it is still paid for? Right now "Remove" only takes it off the list.
