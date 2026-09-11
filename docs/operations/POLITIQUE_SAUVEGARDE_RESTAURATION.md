# Politique de sauvegarde et restauration

## 1. Objectifs RPO / RTO
Les objectifs doivent être définis par environnement et validés par les responsables métier et techniques.
- **RPO cible** : perte de données acceptable la plus faible possible pour les opérations académiques et financières ;
- **RTO cible** : délai de rétablissement compatible avec la continuité pédagogique et administrative.

> **Note**
> Tant que certains modules restent en évolution, les objectifs exacts doivent être revalidés à chaque changement majeur d’architecture ou d’intégration.

## 2. Périmètre sauvegardé
Le périmètre recommandé couvre :
- données applicatives ;
- paramètres multi-tenant ;
- journaux utiles à l’audit et à l’investigation ;
- documents nécessaires à l’exploitation ;
- secrets et configurations selon une politique séparée et sécurisée.

## 3. Fréquence des sauvegardes
Politique cible recommandée :
- sauvegardes régulières des données critiques ;
- rétention adaptée aux obligations légales et opérationnelles ;
- conservation distincte pour limiter le risque de perte globale ;
- surveillance automatique des échecs.

## 4. Procédure de restauration
1. qualifier le besoin de restauration ;
2. identifier la sauvegarde valide la plus pertinente ;
3. obtenir l’approbation requise ;
4. restaurer dans un environnement maîtrisé si possible ;
5. vérifier l’intégrité fonctionnelle et des accès ;
6. consigner l’opération et le résultat.

## 5. Tests de restauration
- tester périodiquement la restauration ;
- vérifier les cas critiques : académiques, financiers, administratifs ;
- mesurer les délais réels de reprise ;
- corriger les écarts observés.

## 6. Conservation et sécurité des sauvegardes
- chiffrer ou protéger fortement les sauvegardes ;
- limiter strictement les accès ;
- séparer les responsabilités d’exploitation et d’approbation ;
- tracer les téléchargements et restaurations ;
- protéger particulièrement les données d’enfants et pièces sensibles.
