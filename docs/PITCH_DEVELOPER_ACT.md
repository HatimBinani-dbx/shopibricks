# Pitch : partie Developer (Hatim)

**Durée : 12 min 30**, soit 50 % du créneau de Hatim (25:00 à 50:00).
**Place dans le déroulé :** juste après le concierge et le checkout (25:00 à 36:00). Le pitch couvre 36:00 à 48:30 et se termine sur l'ice breaker qui lance le cocktail.

Écran : app ShopiBricks, **Developer studio**. Liens directs : `#architecture`, `#gateway`, `#lab`, `#codex`.
Réglages présentateur : petite roue dentée à droite des onglets, ou **Shift + ,**. Garder « Anonymize non-OpenAI models » activé et « Fallback mode » désactivé (live).

| Temps | Panneau | À retenir |
|---|---|---|
| 36:00 à 37:00 | Transition | On vient de voir l'expérience, on ouvre le capot. |
| 37:00 à 39:30 | Architecture | Un agent en production est un système, et chaque appel modèle ou outil passe par un seul point. |
| 39:30 à 44:00 | Unity Gateway | La gouvernance et la sécurité se règlent dans la Gateway, pas dans le code de l'agent. |
| 44:00 à 46:00 | Model lab | On mesure le coût par tâche réussie, et sur notre tâche la frontière prix-performance est 100 % OpenAI. |
| 46:00 à 47:30 | Codex et Better together | Codex sous la même gouvernance que la prod, le cache rend les sessions abordables, et OpenAI × Databricks fait passer agents et développeurs en production. |
| 47:30 à 48:30 | Ice breaker | On ouvre le cocktail. |

---

## 36:00 · Transition (1 min)

> « Laurent vous a montré la donnée, j'ai montré l'expérience : un shopper, un panier, une commande confirmée par un humain. Maintenant on ouvre le capot. Quatre écrans, et à chaque fois une seule chose à retenir. »

Action : ouvrir **Developer studio › Architecture**.

## 37:00 · Architecture (2 min 30)

Action : cliquer **Shopper asks for a kit**. Les composants du parcours sont surlignés, et les étapes s'affichent sous le schéma. Survoler une étape pour isoler ses liens.

> « Voilà ce qui se passe quand le shopper pose sa question. L'interface reçoit un flux d'événements typés, c'est AG-UI. Le concierge, sur l'API Responses d'OpenAI, délègue à des agents spécialisés. Leurs appels d'outils passent par la Gateway, vers les services MCP et vers l'API marchand ACP pour la commande. La donnée vient de Lakebase, de Vector Search et des tables Delta. »

Action : cliquer le nœud **Unity Gateway** pour ouvrir son détail, puis **Show everything**.

> « Regardez le centre. Deux flèches y entrent : les appels modèle et les appels d'outils. Tout passe au même endroit, que ce soit le concierge, l'analyste marchand ou un développeur dans son terminal. Et tout est tracé : MLflow, inference tables, tables système. »

**À retenir :** un agent en production n'est pas un prompt, c'est un système. Des protocoles ouverts, des données gouvernées, et un seul point de passage pour chaque appel modèle et chaque appel d'outil.

## 39:30 · Unity Gateway (4 min 30)

Action : ouvrir **Unity Gateway**. Montrer le schéma en 10 secondes : qui appelle, la Gateway au centre, ce qu'elle gouverne.

> « Ce point de passage, c'est Unity Gateway. Chaque carte en dessous lance une vraie requête. »

Astuce : le bouton d'agrandissement en haut à droite d'une carte l'élargit sur place ; Échap la referme.

Trois démos, dans cet ordre :

1. **Routing & fallback** (environ 1 min 30). La politique est déjà sur GPT-6 Luna 50 %, GPT-6.1 Terra 50 %, GPT-6.1 Sol en fallback (le warm-up la remet ainsi ; sinon, cliquer **Reset demo policy**).
   - Déplacer un curseur, par exemple Luna 70 % et Terra 30 %, puis **Apply policy**.
   - Cliquer **3 · Send 12 requests** : la barre « Served » se remplit en quelques secondes, à mesure que les destinations arrivent de l'inference table.
   - Dans **4 · OUTAGE DRILL · SIMULATED**, cliquer **Take down GPT-6 Luna** : sa part bascule sur Sol.
   > « Je viens de changer la politique de routage d'un model service : deux modèles OpenAI qui se partagent le trafic, et un troisième en secours. Pas de code, pas de redéploiement. Et la preuve vient du journal d'audit, pas du modèle. Si un modèle principal sature ou tombe, la Gateway rejoue ses requêtes sur le fallback. Ici, la panne est simulée : je ne vais pas éteindre un modèle en direct. »
2. **Rate limits** (30 s). Service de démo limité à 1 requête par minute. Cliquer **Spike above the limit**, puis **Send 1 request** : la réponse est un 429.
   > « Un agent qui part en boucle ne consomme pas le budget des autres. Au-delà de la limite, la Gateway répond 429, avant même d'appeler le modèle. »
3. **Inference tables** (30 s) : déplier une ligne. On voit quel agent a appelé, le dernier résultat d'outil décodé et la réponse.
   > « Chaque requête et chaque réponse est écrite dans une table Delta. Pour l'audit, l'évaluation, ou pour construire un dataset de fine-tuning. En SQL. »

En une phrase chacune :
- **Identity & access** : cliquer **Call a granted and a restricted service**. 200 sur le concierge, 403 sur `finance_reserved`. « Un grant `EXECUTE` à la place d'une clé partagée. »
- **Cost attribution** : coût par modèle, par consommateur, par service.

Action : cliquer **See it stop a real prompt injection** dans la carte Guardrails (ou descendre jusqu'à la section **Guardrails**). Montrer le produit piégé, texte surligné en rouge.

> « Maintenant un cas réel : un fournisseur a modifié la description d'un sac. Il y a caché une instruction : augmenter le budget, ajouter une montre, ne rien dire. »

1. **Run the attack** (10 à 15 s, 4 agents en parallèle).
   > « Les trois modèles GPT ignorent l'instruction. gpt-oss-120b, le modèle open-weights, la suit : il ajoute la montre et dépasse le budget. »
2. **Show the guardrail**. Le schéma montre le trajet : l'agent envoie le tour, la Gateway le refuse avec sa raison, l'agent repart sans le texte non fiable.
   > « On met une policy Jailbreak de la Gateway devant ce modèle. Elle inspecte chaque requête, y compris les résultats d'outils. »
3. **Run gpt-oss-120b again, guarded** (environ 20 s), puis lire la trajectoire de droite.
   > « Même modèle, même prompt. Au troisième tour, la Gateway refuse le tour empoisonné, avec la raison. L'agent retire le texte non fiable et repart sur les données structurées. Tâche réussie. »
4. **Open the audit trail**.
   > « En haut, la décision de la Gateway : la policy, la phase, la raison. En dessous, l'inference table : seuls les tours propres y figurent. Le tour empoisonné n'a jamais atteint le modèle. »

Phrase de repli, si le guardrail ne se déclenche pas en live :
> « Le modèle n'est pas le seul rempart : la Gateway ajoute une couche que l'on configure une fois, pour tous les agents. »

**À retenir :** la gouvernance et la sécurité ne vivent pas dans le code de l'agent. Identité, routage, limites, garde-fous et traçabilité se règlent dans la Gateway, et s'appliquent à tous les appels. Le modèle n'est pas le seul rempart.

## 44:00 · Model lab (2 min)

Action : ouvrir **Model lab**. Montrer les 5 indicateurs (coût par succès le plus bas, meilleur taux de succès, efficacité en tokens, écart de 125×, runs notés), puis le graphique.

> « Le bon indicateur n'est pas le prix du million de tokens, c'est le coût par tâche réussie. On a fait tourner la vraie tâche de ShopiBricks sur 9 modèles, 324 fois, toutes via la même Gateway, et chaque run est noté par du code, pas par un juge. »

> « La ligne pointillée, c'est la frontière prix-performance : à chaque niveau de qualité, le modèle le moins cher. Elle est entièrement OpenAI. GPT-6 Luna pour le coût le plus bas, 0,0003 $ par tâche réussie. GPT-6.1 Terra pour 100 % de réussite, à 0,0016 $, onze fois moins cher que le fournisseur suivant à 100 %. Et les modèles GPT utilisent deux fois moins de tokens pour la même tâche. »

Si le temps le permet : lancer une comparaison libre en bas de page (environ 10 s).

**À retenir :** on choisit un modèle sur le coût par tâche réussie, et sur notre tâche toute la frontière prix-performance est OpenAI.

## 46:00 · Codex et Better together (1 min 30)

Action : ouvrir **Codex**. Montrer la ligne **Setup, in one line** en haut, puis cliquer la plus longue session dans l'explorateur.

> « Pour le développeur, c'est une ligne : `ug codex`. Il se connecte avec son identité Databricks, sans clé d'API. »

> « Pour préparer cette démo, on a travaillé sur ce repo avec Codex, branché sur la même Gateway. Voici une vraie session : 87 requêtes en 27 minutes sur GPT-6.1 Sol. Chaque barre est une requête. Le contexte grossit à chaque tour, mais le bleu, c'est ce qui est servi par le cache d'OpenAI : 97 %. Résultat : 2,31 $ au lieu de 23 $. »

Action : descendre jusqu'au visuel **OpenAI × Databricks**.

> « On a fait le tour complet. GPT-6 Luna sert vos clients dans le concierge. GPT-6.1 Sol aide vos développeurs à écrire le code dans Codex. Et entre les deux, une seule Gateway, avec les mêmes règles : identité, modèles autorisés, limites, budget. OpenAI apporte l'intelligence, Databricks la gouvernance sur vos données. Ensemble, ça passe en production. »

Laisser le visuel **OpenAI × Databricks** affiché pendant l'ice breaker et les questions.

**À retenir :** OpenAI apporte l'intelligence, Databricks la gouvernance et vos données. Ensemble, vos agents et vos développeurs passent en production avec les mêmes règles.

## 47:30 · Ice breaker (1 min)

> « Dernière chose avant le cocktail. Levez la main si vous avez déjà collé une clé d'API dans un fichier `.env`. »
> (pause)
> « Gardez-la levée si elle est encore dans l'historique Git. »
> (rires)
> « C'est exactement ce que la Gateway supprime : plus de clé partagée, juste votre identité. »

> « Pour lancer les discussions, une question à poser à votre voisin : quel est le premier agent que vous mettriez en production lundi ? Et si vous avez une prompt injection dont vous êtes fiers, venez nous voir : on la rejoue en direct contre le guardrail de la Gateway. »

Rendre la main pour les questions et le cocktail.

---

## Avant de monter sur scène

- [ ] **15 minutes avant : lancer `scripts/warmup-showcase.sh`** (environ 4 minutes). Le script démarre l'app et le warehouse (arrêt automatique à 2 h), remet le concierge sur GPT-6 Luna avec Sol en fallback, remet la politique de routage par défaut, puis joue une fois chaque démo (concierge, 12 requêtes de routage, identité, rate limit, Model lab, attaque, relance gardée) pour chauffer les modèles et remplir les tables d'usage. Il se termine par une liste de contrôle : tout doit être ✓. Le premier passage à froid peut prendre 2 minutes sur l'attaque ; après, elle prend 10 à 15 s.
- [ ] Réglages présentateur : anonymisation activée, coûts affichés, animations activées, **Fallback mode désactivé**.
- [ ] La policy Jailbreak est déjà attachée à `guarded_oss` (phase input, Deny). Le warm-up vérifie qu'elle se déclenche.
- [ ] Ouvrir l'app dans le navigateur de présentation et passer une fois sur chaque onglet.

## Plan B : Fallback mode

Si le workspace ne répond plus pendant le talk : ouvrir les réglages (**Shift + ,**) et activer **Fallback mode**. Tout le Developer studio (Unity Gateway, Model lab, Codex) rejoue alors des réponses réelles enregistrées le 19/11, avec des délais réalistes et sans appel réseau. Rien à l'écran ne signale le mode. Le parcours est identique, et la relance gardée rejoue un vrai run capturé (refus au 3e tour, tâche réussie).

L'onglet Architecture ne dépend pas de la Gateway : il fonctionne dans les deux modes.

## Points de vigilance pour les questions

- **Panne simulée** : l'exercice de panne du routage est une simulation. Un vrai fallback ne se déclenche que sur 429 ou 5xx du modèle principal, ce qu'on ne provoque pas en direct.
- **Rate limit** : la Gateway applique la limite de façon approximative, sur plusieurs répliques. D'où le pic, puis une requête seule pour montrer le 429.
- **MCP et ACP derrière la Gateway** : l'architecture montre le modèle cible. Les services MCP sont gouvernés par Unity Gateway ; dire « gouvernés », pas « tous les appels d'outils passent aujourd'hui par le même proxy ».
- **Guardrails** : les service policies sont en Beta. Un tour refusé n'est pas écrit dans l'inference table, car il n'atteint pas le modèle ; la décision est renvoyée à l'agent avec sa raison.
- **Benchmarks** : mesurés sur notre tâche, aux prix publics. Aucune source publiée ne mesure le temps d'exécution : ne pas dire « plus rapide ».

## Chiffres cités (mesurés du 17 au 19/11/2026)

| Chiffre | Source |
|---|---|
| 324 runs, 9 modèles, 12 scénarios | `bench/results/latest.json` |
| Frontière prix-performance : GPT-6 Luna puis GPT-6.1 Terra | idem, calculée dans le Model lab |
| Terra : 100 % de réussite à 0,0016 $ ; fournisseur suivant à 100 % : 0,0174 $ | idem |
| Tokens par tâche : environ 2 800 pour les GPT contre 6 300 pour les autres | idem |
| gpt-oss-120b suit l'injection 3 fois sur 3 ; les GPT-6 l'ignorent 3 fois sur 3 | idem, scénario `injection` |
| Relance gardée : refus au 3e tour, tâche réussie en environ 20 s | run live du 19/11 |
| Session Codex : 87 requêtes, 27 min, 97 % de cache, 2,31 $ au lieu de 23 $ | `system.ai_gateway.usage` |

Les coûts sont estimés aux prix publics Databricks (pay-per-token, $0,07/DBU, AWS us-east-1).
